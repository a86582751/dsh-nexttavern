window.__ModuleLoader__.load({ id: "dsh-nexttavern-ui-chat", factory: function (require) { var module = { exports: {} }; var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from2, except, desc) => {
  if (from2 && typeof from2 === "object" || typeof from2 === "function") {
    for (let key19 of __getOwnPropNames(from2))
      if (!__hasOwnProp.call(to, key19) && key19 !== except)
        __defProp(to, key19, { get: () => from2[key19], enumerable: !(desc = __getOwnPropDesc(from2, key19)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var index_exports = {};
__export(index_exports, {
  EMPTY_CHAT_SNAPSHOT: () => EMPTY_CHAT_SNAPSHOT,
  apply: () => apply,
  inject: () => inject,
  isRunningTool: () => isRunningTool,
  isSettledTool: () => isSettledTool
});
module.exports = __toCommonJS(index_exports);

// apply.ts
var import_dsh_client_store6 = require("@deepseek-ai/dsh-client-store");

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-util-workspace-path/lib/index.js
var FILE_ADDRESS_PREFIX = "dsh-resource://file/";
function encodeSegment(segment) {
  return encodeURIComponent(segment).replace(/%3A/gi, ":");
}
function encodePath(path) {
  return path.split("/").map(encodeSegment).join("/");
}
function sessionFileAddress(sessionId, path) {
  const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
  return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`;
}
function isWindowsStylePath(value) {
  return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
}
function isAbsoluteWorkspacePath(path) {
  return path.startsWith("/") || isWindowsStylePath(path);
}
function fileAddressFor(sessionId, cwd, path) {
  const normalized = path.replace(/\\/g, "/");
  if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized);
  const root = cwd === void 0 ? "" : cwd.replace(/\\/g, "/").replace(/\/+$/, "");
  if (root !== "" && normalized === root) return sessionFileAddress(sessionId, "");
  if (root !== "" && normalized.startsWith(`${root}/`)) return sessionFileAddress(sessionId, normalized.slice(root.length + 1));
  return sessionFileAddress(sessionId, normalized);
}

// contract/snapshot.ts
var EMPTY_LIST = [];
var EMPTY_TIMELINE = { turnOrder: EMPTY_LIST, turns: /* @__PURE__ */ new Map() };
var EMPTY_NODE_SOURCE = {
  getSnapshot: () => void 0,
  subscribe: () => () => {
  }
};
var EMPTY_NODE_PROCESS_SOURCE = {
  getSnapshot: () => void 0,
  subscribe: () => () => {
  }
};
var EMPTY_TURN_NODE_SOURCE = {
  getSnapshot: () => EMPTY_LIST,
  subscribe: () => () => {
  }
};
var EMPTY_CHAT_SNAPSHOT = {
  order: EMPTY_LIST,
  nodes: {
    get: () => void 0,
    source: () => EMPTY_NODE_SOURCE,
    turnDataSource: () => EMPTY_TURN_NODE_SOURCE,
    processSource: () => EMPTY_NODE_PROCESS_SOURCE,
    values: () => EMPTY_LIST
  },
  locations: {
    getTurn: () => EMPTY_LIST,
    getStep: () => EMPTY_LIST
  },
  navigation: {
    items: () => EMPTY_LIST
  },
  timeline: EMPTY_TIMELINE,
  legacy: {
    nodes: EMPTY_LIST,
    turnTimings: /* @__PURE__ */ new Map(),
    turnEnds: /* @__PURE__ */ new Map(),
    partial: null,
    runningCalls: EMPTY_LIST
  }
};

// chat/ApprovalCommand.tsx
function commandOf(call) {
  if (call === void 0) return void 0;
  try {
    const args = JSON.parse(call.argsRaw);
    return typeof args.command === "string" ? args.command : void 0;
  } catch {
    return void 0;
  }
}
function ApprovalCommand({ callId, useChat }) {
  const command = useChat((snapshot2) => {
    for (const node of snapshot2.nodes.values()) {
      const root = node.kind === "tool-call" ? node.data.root : void 0;
      if (root !== void 0 && root.callId === callId && !("kind" in root)) return commandOf(root);
    }
    return void 0;
  });
  return command ?? null;
}

// chat/ChatView.tsx
var import_react16 = require("react");
var import_dsh_client_ui_primitives8 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/MessageItem.tsx
var import_react5 = require("react");
var import_dsh_client_ui_primitives5 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/CompactionItem.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// markdown-labels.ts
function markdownLabels(t) {
  return {
    code: { copyLabel: t("copy"), copiedLabel: t("copied") },
    footnotes: t("markdown.footnotes")
  };
}

// chat/MessageItem.module.css
var owner = "dsh-nexttavern-ui-chat";
var key = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/MessageItem.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner;
  style.dataset.pluginCss = key;
  style.textContent = '.LER49a_userRow{flex-direction:column;align-items:flex-end;gap:6px;display:flex}.LER49a_userStack{min-width:0;max-width:min(calc(var(--dsh-chat-content-width,748px) * .702), 82%);flex-direction:column;align-items:flex-end;gap:8px;display:flex}.LER49a_bubble{background:var(--dsw-specific-bubble);max-width:100%;font-size:var(--dsh-content-font-size,14px);line-height:calc(22px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;border-radius:22px;padding:10px 16px}.LER49a_referenceSummary{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px))}.LER49a_contextRow{padding:2px 0}.LER49a_compactionRow{--dsh-compaction-header-height:calc(24px + var(--dsh-content-font-delta,0px));padding:2px 0}.LER49a_compactionButton{width:100%;height:var(--dsh-compaction-header-height);min-width:0;color:inherit;font:inherit;text-align:left;background:0 0;border:none;border-radius:6px;align-items:center;padding:0;display:flex}.LER49a_compactionRow:has(.LER49a_compactionBody) .LER49a_compactionButton{z-index:7;background:var(--dsw-alias-bg-base);border-radius:0;position:sticky;top:0}.LER49a_compactionBody :has(>[data-code-block-banner]){top:var(--dsh-compaction-header-height)}.LER49a_compactionRow:has(.LER49a_compactionBody) .LER49a_compactionButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}.LER49a_compactionButton:not(:disabled){cursor:pointer}.LER49a_compactionButton:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover)}.LER49a_compactionLeading{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-secondary);flex:none;place-items:center;margin-right:6px;display:inline-grid}.LER49a_compactionLeading svg{width:calc(14px + var(--dsh-content-font-delta,0px));height:calc(14px + var(--dsh-content-font-delta,0px))}.LER49a_compactionContextIcon,.LER49a_compactionDisclosureIcon{grid-area:1/1;justify-content:center;align-items:center;display:inline-flex}.LER49a_compactionDisclosureIcon,.LER49a_compactionButton:not(:disabled):hover .LER49a_compactionContextIcon,.LER49a_compactionButton:not(:disabled):focus-visible .LER49a_compactionContextIcon{opacity:0}.LER49a_compactionButton:not(:disabled):hover .LER49a_compactionDisclosureIcon,.LER49a_compactionButton:not(:disabled):focus-visible .LER49a_compactionDisclosureIcon{opacity:1}.LER49a_compactionTitle{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-primary-dimmed);flex:none}.LER49a_compactionSep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.LER49a_compactionSummary{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}.LER49a_compactionBody{padding:4px 0 4px calc(22px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px))}.LER49a_retryRow{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px))}.LER49a_retrySummary{width:fit-content;color:inherit;cursor:pointer;user-select:none;border-radius:3px;align-items:center;gap:7px;padding:2px 0;list-style:none;display:inline-flex}.LER49a_retrySummary::-webkit-details-marker{display:none}.LER49a_retrySummary:after{content:"";opacity:.8;border-bottom:1.5px solid;border-right:1.5px solid;width:6px;height:6px;transition:transform .12s;transform:rotate(-45deg)}.LER49a_retrySummary:hover{color:var(--dsw-alias-label-secondary)}.LER49a_retrySummary:focus-visible{outline:1.5px solid var(--dsw-alias-button-info-fill);outline-offset:2px}.LER49a_retryText{color:inherit}.LER49a_retryRow[data-active] .LER49a_retryText{background:linear-gradient(90deg, var(--dsw-alias-label-tertiary) 0%, var(--dsw-alias-label-tertiary) 40%, var(--dsw-alias-label-secondary) 50%, var(--dsw-alias-label-tertiary) 60%, var(--dsw-alias-label-tertiary) 100%);color:#0000;background-position:100%;background-size:200% 100%;background-clip:text;animation:1.6s ease-in-out infinite LER49a_retry-shimmer}.LER49a_retryRow[open] .LER49a_retrySummary:after{transform:rotate(45deg)}.LER49a_retryDetails{overflow-wrap:anywhere;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px));gap:2px;margin-top:3px;padding-left:14px;display:grid}.LER49a_retryDetailLabel{color:var(--dsw-alias-label-secondary)}.LER49a_turnErrorRow{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));grid-template-columns:10px minmax(0,1fr) auto;align-items:start;gap:8px;padding:2px 0;display:grid}.LER49a_turnErrorDot{margin-top:5px}.LER49a_turnErrorCopy{overflow-wrap:anywhere;min-width:0}.LER49a_turnErrorTitle{color:var(--dsw-alias-state-error-primary);margin-right:6px;font-weight:600}.LER49a_turnErrorMessage{color:var(--dsw-alias-label-secondary)}.LER49a_turnErrorCode{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-markdown-code-block-small)}.LER49a_maxTokensTitle{color:var(--dsw-alias-state-warn-primary);margin-right:6px;font-weight:600}@keyframes LER49a_retry-shimmer{0%{background-position:100%}to{background-position:0}}@media (prefers-reduced-motion:reduce){.LER49a_retryRow[data-active] .LER49a_retryText{color:inherit;background:0 0;animation:none}}.LER49a_attachmentRow{flex-wrap:wrap;justify-content:flex-end;gap:8px;max-width:100%;display:flex}.LER49a_fileCard{border:.5px solid var(--dsw-alias-border-l2,#0000001f);background:var(--dsw-specific-input-major,transparent);box-sizing:border-box;border-radius:16px;flex:0 0 240px;align-items:center;gap:10px;width:240px;min-height:64px;padding:8px 12px;display:inline-flex}.LER49a_fileIcon{flex:none;width:28px;height:28px}.LER49a_fileContent{flex-direction:column;flex:1;min-width:0;display:flex}.LER49a_fileName{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px;overflow:hidden}.LER49a_fileMeta{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-tertiary,#00000073);font-size:12px;line-height:15px;overflow:hidden}';
  document.head.appendChild(style);
}
var MessageItem_default = { "attachmentRow": "LER49a_attachmentRow", "bubble": "LER49a_bubble", "compactionBody": "LER49a_compactionBody", "compactionButton": "LER49a_compactionButton", "compactionContextIcon": "LER49a_compactionContextIcon", "compactionDisclosureIcon": "LER49a_compactionDisclosureIcon", "compactionLeading": "LER49a_compactionLeading", "compactionRow": "LER49a_compactionRow", "compactionSep": "LER49a_compactionSep", "compactionSummary": "LER49a_compactionSummary", "compactionTitle": "LER49a_compactionTitle", "contextRow": "LER49a_contextRow", "fileCard": "LER49a_fileCard", "fileContent": "LER49a_fileContent", "fileIcon": "LER49a_fileIcon", "fileMeta": "LER49a_fileMeta", "fileName": "LER49a_fileName", "maxTokensTitle": "LER49a_maxTokensTitle", "referenceSummary": "LER49a_referenceSummary", "retry-shimmer": "LER49a_retry-shimmer", "retryDetailLabel": "LER49a_retryDetailLabel", "retryDetails": "LER49a_retryDetails", "retryRow": "LER49a_retryRow", "retrySummary": "LER49a_retrySummary", "retryText": "LER49a_retryText", "turnErrorCode": "LER49a_turnErrorCode", "turnErrorCopy": "LER49a_turnErrorCopy", "turnErrorDot": "LER49a_turnErrorDot", "turnErrorMessage": "LER49a_turnErrorMessage", "turnErrorRow": "LER49a_turnErrorRow", "turnErrorTitle": "LER49a_turnErrorTitle", "userRow": "LER49a_userRow", "userStack": "LER49a_userStack" };

// chat/CompactionItem.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var CompactionItem = (0, import_react.memo)(function CompactionItem2({
  node,
  title,
  fallbackSummary,
  t
}) {
  const [expanded, setExpanded] = (0, import_react.useState)(false);
  const labels = (0, import_react.useMemo)(() => markdownLabels(t), [t]);
  const expandable = node.summary !== null;
  const open = expandable && expanded;
  const summary = node.shadowedItemCount !== null && node.shadowedTokenCount !== null ? t("message.compaction.completed", {
    items: node.shadowedItemCount,
    tokens: node.shadowedTokenCount
  }) : fallbackSummary ?? (expandable ? t("message.compaction.expand") : t("message.compaction.unavailable"));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: MessageItem_default.compactionRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        className: MessageItem_default.compactionButton,
        disabled: !expandable,
        "aria-expanded": expandable ? open : void 0,
        onClick: () => {
          setExpanded((value) => !value);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: MessageItem_default.compactionLeading, "aria-hidden": true, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: MessageItem_default.compactionContextIcon, "data-compaction-icon": "context", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconApiOutlineRegular, {}) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "span",
              {
                className: MessageItem_default.compactionDisclosureIcon,
                "data-compaction-disclosure": open ? "expanded" : "collapsed",
                children: open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: MessageItem_default.compactionTitle, children: title ?? t("message.compaction") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: MessageItem_default.compactionSep, "aria-hidden": true }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: MessageItem_default.compactionSummary, children: summary })
        ]
      }
    ),
    open && node.summary !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: MessageItem_default.compactionBody, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.MarkdownText, { text: node.summary, labels }) })
  ] });
});

// chat/ContextInjectionRow.tsx
var import_react2 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/ContextBody.tsx
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/ContextBody.module.css
var owner2 = "dsh-nexttavern-ui-chat";
var key2 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/ContextBody.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key2)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner2;
  style.dataset.pluginCss = key2;
  style.textContent = ".ByK_Lq_text{color:var(--dsw-alias-label-secondary);font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.ByK_Lq_fields{border-top:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:2px;margin:8px 0 0;padding-top:8px;display:flex}.ByK_Lq_field{gap:8px;min-width:0;display:flex}.ByK_Lq_fieldKey{min-width:96px;color:var(--dsw-alias-label-caption);flex:none}.ByK_Lq_fieldValue{min-width:0;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;flex:auto;margin:0}.ByK_Lq_files{flex-wrap:wrap;gap:4px 12px;margin:0 0 8px;padding:0;list-style:none;display:flex}.ByK_Lq_file{align-items:baseline;gap:6px;min-width:0;display:flex}.ByK_Lq_filePath{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.ByK_Lq_fileAction{color:var(--dsw-alias-label-caption)}.ByK_Lq_catalogNotice{color:var(--dsw-alias-label-caption);margin:0 0 6px}.ByK_Lq_entries{flex-direction:column;gap:4px;margin:0;padding:0;list-style:none;display:flex}.ByK_Lq_entry{gap:8px;min-width:0;display:flex}.ByK_Lq_entryName{color:var(--dsw-alias-label-secondary);flex:none}.ByK_Lq_entryDescription{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}.ByK_Lq_sections{flex-direction:column;gap:8px;margin:0;display:flex}.ByK_Lq_section{flex-direction:column;gap:2px;min-width:0;display:flex}.ByK_Lq_sectionName{color:var(--dsw-alias-label-caption)}.ByK_Lq_sectionText{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.ByK_Lq_relaySender{color:var(--dsw-alias-label-caption);overflow-wrap:anywhere;margin:0 0 6px}.ByK_Lq_recalls{flex-direction:column;gap:2px;margin:0 0 8px;padding:0;list-style:none;display:flex}.ByK_Lq_recall{gap:8px;min-width:0;display:flex}.ByK_Lq_recallLabel{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.ByK_Lq_recallCounts{color:var(--dsw-alias-label-caption);flex:none}";
  document.head.appendChild(style);
}
var ContextBody_default = { "catalogNotice": "ByK_Lq_catalogNotice", "entries": "ByK_Lq_entries", "entry": "ByK_Lq_entry", "entryDescription": "ByK_Lq_entryDescription", "entryName": "ByK_Lq_entryName", "field": "ByK_Lq_field", "fieldKey": "ByK_Lq_fieldKey", "fields": "ByK_Lq_fields", "fieldValue": "ByK_Lq_fieldValue", "file": "ByK_Lq_file", "fileAction": "ByK_Lq_fileAction", "filePath": "ByK_Lq_filePath", "files": "ByK_Lq_files", "recall": "ByK_Lq_recall", "recallCounts": "ByK_Lq_recallCounts", "recallLabel": "ByK_Lq_recallLabel", "recalls": "ByK_Lq_recalls", "relaySender": "ByK_Lq_relaySender", "section": "ByK_Lq_section", "sectionName": "ByK_Lq_sectionName", "sections": "ByK_Lq_sections", "sectionText": "ByK_Lq_sectionText", "text": "ByK_Lq_text" };

// chat/ContextBody.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var MAX_CHARS = 2e4;
var MAX_ENTRIES = 200;
function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function contentRuns(content) {
  const runs = [];
  for (const block of content) {
    if (block.type !== "text") {
      runs.push({ block });
      continue;
    }
    const last = runs[runs.length - 1];
    if (last !== void 0 && "text" in last) last.text += block.text;
    else runs.push({ text: block.text });
  }
  return runs;
}
function unknownBlocks(content) {
  return contentRuns(content).flatMap((run) => "block" in run ? [run.block] : []);
}
function boundedText(text, t) {
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}
${t("json.truncated", { total: text.length })}` : text;
}
function fieldValue(value, t) {
  const text = typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value);
  return boundedText(text, t);
}
function SourceFields({ source, formRendered, t }) {
  const record2 = asRecord(source);
  if (record2 === null) return null;
  const hidden = formRendered ? ["kind", "form"] : ["kind"];
  const rows = Object.entries(record2).filter(([key19]) => !hidden.includes(key19));
  if (rows.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dl", { className: ContextBody_default.fields, "data-context-fields": true, children: rows.map(([key19, value]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: ContextBody_default.field, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { className: ContextBody_default.fieldKey, children: key19 }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { className: ContextBody_default.fieldValue, children: fieldValue(value, t) })
  ] }, key19)) });
}
function UnknownBlocks({ blocks, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: blocks.map((block, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    import_dsh_client_ui_primitives2.JsonBlock,
    {
      label: t("message.unknownBlock"),
      payload: block,
      truncatedLabel: (total) => t("json.truncated", { total })
    },
    index
  )) });
}
function ModelFacingContent({ content, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: contentRuns(content).map((run, index) => "text" in run ? run.text !== "" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("pre", { className: ContextBody_default.text, "data-context-text": true, children: boundedText(run.text, t) }, index) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    import_dsh_client_ui_primitives2.JsonBlock,
    {
      label: t("message.unknownBlock"),
      payload: run.block,
      truncatedLabel: (total) => t("json.truncated", { total })
    },
    index
  )) });
}
function OpaqueBody({ content, source, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ModelFacingContent, { content, t }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SourceFields, { source, formRendered: false, t })
  ] });
}
function instructionChanges(source) {
  const record2 = asRecord(source);
  const list = record2 === null ? void 0 : record2["changes"];
  if (!Array.isArray(list)) return null;
  const changes = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of list) {
    const change = asRecord(entry);
    if (change === null) return null;
    const path = change["path"];
    if (typeof path !== "string" || path === "") return null;
    const action = change["action"];
    if (action !== "set" && action !== "replace" && action !== "remove") return null;
    const digest = change["digest"];
    if (seen.has(path)) continue;
    seen.add(path);
    changes.push({ action, path, ...typeof digest === "string" ? { digest } : {} });
  }
  return changes.length === 0 ? null : changes;
}
function instructionAction(action, baseline) {
  if (action === "remove") return "message.context.instructions.removed";
  if (baseline) return "message.context.instructions.loaded";
  return action === "set" ? "message.context.instructions.added" : "message.context.instructions.updated";
}
function InstructionsBody({ content, source, t }) {
  const changes = instructionChanges(source);
  if (changes === null) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(OpaqueBody, { content, source, t });
  const baseline = asRecord(source)?.["baseline"] === true;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: ContextBody_default.files, "data-context-files": true, children: changes.map((change) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: ContextBody_default.file, title: change.digest, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: ContextBody_default.filePath, children: change.path }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: ContextBody_default.fileAction, children: t(instructionAction(change.action, baseline)) })
    ] }, change.path)) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ModelFacingContent, { content, t })
  ] });
}
function catalogEntries(source) {
  const record2 = asRecord(source);
  const list = record2 === null ? void 0 : record2["entries"];
  if (!Array.isArray(list)) return null;
  const entries = [];
  for (const item of list) {
    const entry = asRecord(item);
    if (entry === null) return null;
    const name = entry["name"];
    const description = entry["description"];
    if (typeof name !== "string" || name === "" || typeof description !== "string") return null;
    entries.push({ name, description });
  }
  return entries;
}
function CatalogBody({ content, source, t }) {
  const entries = catalogEntries(source);
  if (entries === null) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(OpaqueBody, { content, source, t });
  const update = asRecord(source)?.["update"] === true;
  const shown = entries.slice(0, MAX_ENTRIES);
  const rest = unknownBlocks(content);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    update && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: ContextBody_default.catalogNotice, "data-context-catalog-update": true, children: t("message.context.catalog.replaced") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: ContextBody_default.entries, "data-context-entries": true, children: shown.map((entry, index) => (
      // Index key: a hand-edited or foreign log may repeat a name, and a
      // duplicate React key would drop a row the model did see.
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: ContextBody_default.entry, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { className: ContextBody_default.entryName, children: entry.name }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: ContextBody_default.entryDescription, children: entry.description })
      ] }, index)
    )) }),
    shown.length < entries.length && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: ContextBody_default.catalogNotice, "data-context-entries-truncated": true, children: t("message.context.catalog.more", { count: entries.length - shown.length }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(UnknownBlocks, { blocks: rest, t })
  ] });
}
function snapshotSections(source) {
  const record2 = asRecord(source);
  const list = record2 === null ? void 0 : record2["sections"];
  if (!Array.isArray(list)) return null;
  const sections = [];
  for (const item of list) {
    const section = asRecord(item);
    if (section === null) return null;
    const name = section["name"];
    const text = section["text"];
    if (typeof name !== "string" || name === "" || typeof text !== "string") return null;
    sections.push({ name, text });
  }
  return sections.length === 0 ? null : sections;
}
function SnapshotBody({ content, source, t }) {
  const sections = snapshotSections(source);
  if (sections === null) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(OpaqueBody, { content, source, t });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: ContextBody_default.catalogNotice, "data-context-snapshot-supersedes": true, children: t("message.context.snapshot.supersedes") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dl", { className: ContextBody_default.sections, "data-context-sections": true, children: sections.map((section, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: ContextBody_default.section, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dt", { className: ContextBody_default.sectionName, children: section.name }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("dd", { className: ContextBody_default.sectionText, children: boundedText(section.text, t) })
    ] }, index)) })
  ] });
}
function NoticeBody({ content, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ModelFacingContent, { content, t });
}
function RelayBody({ content, source, t }) {
  const sender = relaySender(source);
  if (sender === null) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(OpaqueBody, { content, source, t });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: ContextBody_default.relaySender, "data-context-relay-sender": true, children: t("message.context.relay.from", { session: sender }) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ModelFacingContent, { content, t })
  ] });
}
function relaySender(source) {
  const sender = asRecord(source)?.["senderSessionId"];
  return typeof sender === "string" && sender !== "" ? sender : null;
}
function recalledSessions(source) {
  const record2 = asRecord(source);
  const list = record2 === null ? void 0 : record2["references"];
  if (!Array.isArray(list)) return null;
  const sessions = [];
  for (const item of list) {
    const reference = asRecord(item);
    if (reference === null) return null;
    const label = reference["label"];
    const retained = reference["retainedMessages"];
    const omitted = reference["omittedMessages"];
    const truncated = reference["truncated"];
    if (typeof label !== "string" || label === "" || typeof retained !== "number" || typeof omitted !== "number" || typeof truncated !== "boolean") return null;
    sessions.push({ label, retained, omitted, truncated });
  }
  return sessions.length === 0 ? null : sessions;
}
function RecallBody({ content, source, t }) {
  const sessions = recalledSessions(source);
  if (sessions === null) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(OpaqueBody, { content, source, t });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: ContextBody_default.recalls, "data-context-recalls": true, children: sessions.map((session, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: ContextBody_default.recall, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: ContextBody_default.recallLabel, children: session.label }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: ContextBody_default.recallCounts, children: t("message.context.recall.counts", {
        retained: session.retained,
        omitted: session.omitted
      }) }),
      session.truncated && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: ContextBody_default.recallCounts, children: t("message.context.recall.truncated") })
    ] }, index)) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ModelFacingContent, { content, t })
  ] });
}
function noticeSummary(source) {
  const summary = asRecord(source)?.["summary"];
  return typeof summary === "string" && summary !== "" ? summary : null;
}
function contextBody(form, props) {
  const opaque = { rendered: null, summary: null, body: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(OpaqueBody, { ...props }) };
  switch (form) {
    case "instructions":
      return instructionChanges(props.source) === null ? opaque : { rendered: "instructions", summary: null, body: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(InstructionsBody, { ...props }) };
    case "catalog":
      return catalogEntries(props.source) === null ? opaque : { rendered: "catalog", summary: null, body: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CatalogBody, { ...props }) };
    case "snapshot":
      return snapshotSections(props.source) === null ? opaque : { rendered: "snapshot", summary: null, body: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(SnapshotBody, { ...props }) };
    case "notice": {
      const summary = noticeSummary(props.source);
      return summary === null ? opaque : { rendered: "notice", summary, body: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(NoticeBody, { ...props }) };
    }
    case "relay":
      return relaySender(props.source) === null ? opaque : { rendered: "relay", summary: null, body: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RelayBody, { ...props }) };
    case "recall":
      return recalledSessions(props.source) === null ? opaque : { rendered: "recall", summary: null, body: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RecallBody, { ...props }) };
    case null:
      return opaque;
    /* v8 ignore next 4 -- closed-union backstop; the compiler rejects a new
    KnownContextForm here rather than letting it degrade to opaque silently. */
    default: {
      const unreachable = form;
      throw new Error(`unreachable context form: ${String(unreachable)}`);
    }
  }
}

// chat/ContextInjectionRow.module.css
var owner3 = "dsh-nexttavern-ui-chat";
var key3 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/ContextInjectionRow.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key3)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner3;
  style.dataset.pluginCss = key3;
  style.textContent = ".U48mgq_root{min-width:0}.U48mgq_root[data-open]{padding-bottom:4px}.U48mgq_chevron{color:var(--dsw-alias-label-secondary)}.U48mgq_sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.U48mgq_source{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:none;overflow:hidden}.U48mgq_summary{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}.U48mgq_body{box-sizing:border-box;width:calc(100% - 22px - var(--dsh-content-font-delta,0px));max-height:141px;margin:4px 0 0 calc(22px + var(--dsh-content-font-delta,0px));background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-tertiary);font:400 11px/16px var(--ds-font-family-code);border:none;border-radius:8px;padding:10px 16px 12px 12px;overflow:auto}";
  document.head.appendChild(style);
}
var ContextInjectionRow_default = { "body": "U48mgq_body", "chevron": "U48mgq_chevron", "root": "U48mgq_root", "sep": "U48mgq_sep", "source": "U48mgq_source", "summary": "U48mgq_summary" };

// chat/ContextInjectionRow.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function ContextInjectionRow({ content, source, producer, form, t }) {
  const [open, setOpen] = (0, import_react2.useState)(false);
  const { rendered, summary, body } = contextBody(form, { content, source, t });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    import_dsh_client_ui_primitives3.DisclosureRow,
    {
      className: ContextInjectionRow_default.root,
      icon: producer.role === "recall" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { "data-context-recall-icon": true, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.ReferenceIconRegular, { kind: "session" }) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconContextInjectionOutlineRegular, { size: 14 }),
      chevronClassName: ContextInjectionRow_default.chevron,
      title: t(producer.role === "recall" ? "message.contextRecall" : "message.contextInjection"),
      collapsedContent: producer.label === null ? void 0 : (
        /* ToolRow's separator shape: an aria-hidden dot, so the accessible name
           stays the two readable parts and the two disclosure rows expose one
           name shape. A source that names no producer drops the dot with it. */
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: ContextInjectionRow_default.sep, "aria-hidden": true }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: ContextInjectionRow_default.source, "data-context-source": true, children: producer.label }),
          summary !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: ContextInjectionRow_default.sep, "aria-hidden": true }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: ContextInjectionRow_default.summary, "data-context-summary": true, children: summary })
          ] })
        ] })
      ),
      keepContentWhenOpen: true,
      open,
      expandable: true,
      expandOnRowClick: true,
      onToggle: () => {
        setOpen((value) => !value);
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: ContextInjectionRow_default.body, "data-context-injection-body": true, "data-context-form": rendered ?? void 0, children: body })
    }
  );
}

// chat/MessageIconActions.tsx
var import_react4 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/message-chrome.ts
var LIVE_RUN_CLOCK_INTERVAL_MS = 1e3;
function pad2(n) {
  return String(n).padStart(2, "0");
}
function startOfLocalDay(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function msUntilNextLocalMidnight(ms) {
  const next = new Date(ms);
  next.setHours(24, 0, 0, 0);
  return Math.max(next.getTime() - ms, 1);
}
function formatRunDuration(ms, t) {
  const total = Math.max(0, Math.floor(ms / 1e3));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const seconds = total % 60;
  if (hours > 0) {
    return t("duration.hours", { hours, minutes: pad2(minutes), seconds: pad2(seconds) });
  }
  return minutes > 0 ? t("duration.minutes", { minutes, seconds: pad2(seconds) }) : t("duration.seconds", { seconds });
}
function formatLiveRunDuration(ms, t) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1e3));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = String(totalSeconds % 60);
  if (hours > 0) return t("duration.hours", { hours, minutes: pad2(minutes), seconds });
  return minutes > 0 ? t("duration.minutes", { minutes, seconds }) : t("duration.seconds", { seconds });
}
function formatTokensPerSecond(tps) {
  const clamped = Math.max(0, tps);
  return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10);
}
function formatMessageClock(time, t, now = Date.now()) {
  const d = new Date(time);
  const n = new Date(now);
  const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()) {
    return clock;
  }
  const params = { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  const md = d.getFullYear() === n.getFullYear() ? t("clock.md", params) : t("clock.ymd", params);
  return `${md} ${clock}`;
}

// chat/use-calendar-day.ts
var import_react3 = require("react");
function useCalendarDay() {
  const [day, setDay] = (0, import_react3.useState)(() => startOfLocalDay(Date.now()));
  (0, import_react3.useEffect)(() => {
    let timer;
    const arm = () => {
      const now = Date.now();
      setDay(startOfLocalDay(now));
      timer = setTimeout(arm, msUntilNextLocalMidnight(now));
    };
    timer = setTimeout(arm, msUntilNextLocalMidnight(Date.now()));
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return day;
}

// chat/MessageIconActions.module.css
var owner4 = "dsh-nexttavern-ui-chat";
var key4 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/MessageIconActions.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key4)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner4;
  style.dataset.pluginCss = key4;
  style.textContent = ".WGRsMa_actions{height:calc(28px + var(--dsh-content-font-delta,0px));align-items:center;gap:8px;display:flex}.WGRsMa_timeStart{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary);white-space:nowrap;padding-right:12px}.WGRsMa_timeEnd{font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:inherit;white-space:nowrap}.WGRsMa_endInfo{min-width:0;color:var(--dsw-alias-label-tertiary);align-items:center;gap:8px;margin-left:8px;display:inline-flex}@media (hover:hover){[data-actions-reveal=hover] .WGRsMa_actions,:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering]):has(~:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering])) .WGRsMa_actions{opacity:0;transition:opacity 80ms}[data-actions-reveal=hover]:hover .WGRsMa_actions,[data-actions-reveal=hover]:focus-within .WGRsMa_actions,:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering]):has(~:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering])):hover .WGRsMa_actions,:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering]):has(~:is([data-chat-flow-kind=user],[data-chat-flow-kind=steering])):focus-within .WGRsMa_actions{opacity:1}}.WGRsMa_action{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:28px;justify-content:center;align-items:center;padding:6px;display:inline-flex}.WGRsMa_action svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}.WGRsMa_actions[data-clock=end] .WGRsMa_action svg{width:calc(17px + var(--dsh-content-font-delta,0px));height:calc(17px + var(--dsh-content-font-delta,0px))}.WGRsMa_action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.WGRsMa_action[data-unavailable]{cursor:default;opacity:.4}.WGRsMa_action[data-unavailable]:hover{color:var(--dsw-alias-label-tertiary);background:0 0}.WGRsMa_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";
  document.head.appendChild(style);
}
var MessageIconActions_default = { "action": "WGRsMa_action", "actions": "WGRsMa_actions", "endInfo": "WGRsMa_endInfo", "timeEnd": "WGRsMa_timeEnd", "timeStart": "WGRsMa_timeStart", "visuallyHidden": "WGRsMa_visuallyHidden" };

// chat/MessageIconActions.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function MessageIconActions({
  text,
  time,
  clock,
  onBranch,
  branchUnavailable = false,
  className,
  extraActions,
  usageAction,
  t
}) {
  const day = useCalendarDay();
  const reasonId = (0, import_react4.useId)();
  const [copied, setCopied] = (0, import_react4.useState)(false);
  const copyPending = (0, import_react4.useRef)(false);
  const copyTimer = (0, import_react4.useRef)(null);
  const copyEpoch = (0, import_react4.useRef)(0);
  (0, import_react4.useEffect)(() => () => {
    copyEpoch.current += 1;
    copyPending.current = false;
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
  }, []);
  const onCopy = (0, import_react4.useCallback)(() => {
    if (copied || copyPending.current) return;
    const epoch = copyEpoch.current;
    copyPending.current = true;
    void (0, import_dsh_client_ui_primitives4.writeClipboard)(text).then((ok) => {
      if (epoch !== copyEpoch.current) return;
      copyPending.current = false;
      if (!ok) return;
      setCopied(true);
      copyTimer.current = window.setTimeout(() => {
        copyTimer.current = null;
        setCopied(false);
      }, 1e3);
    });
  }, [copied, text]);
  const clockEl = time === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: clock === "start" ? MessageIconActions_default.timeStart : MessageIconActions_default.timeEnd, children: formatMessageClock(time, t, day) });
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: className === void 0 ? MessageIconActions_default.actions : `${MessageIconActions_default.actions} ${className}`, "data-clock": clock, children: [
    clock === "start" ? clockEl : null,
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Tooltip, { label: copied ? t("copied") : t("copy"), side: "bottom", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: MessageIconActions_default.action, "aria-label": copied ? t("copied") : t("copy"), onClick: onCopy, children: copied ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.IconCheckOutlineRegular, {}) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.IconCopyOutlineRegular, {}) }) }),
    extraActions,
    onBranch !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Tooltip, { label: branchUnavailable ? t("message.branchUnavailable") : t("message.branch"), side: "bottom", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        type: "button",
        className: MessageIconActions_default.action,
        "aria-label": t("message.branch"),
        "aria-disabled": branchUnavailable || void 0,
        "aria-describedby": branchUnavailable ? reasonId : void 0,
        "data-unavailable": branchUnavailable || void 0,
        onClick: branchUnavailable ? void 0 : onBranch,
        children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.IconBranchOutlineRegular, {})
      }
    ) }),
    onBranch !== void 0 && branchUnavailable && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { id: reasonId, className: MessageIconActions_default.visuallyHidden, children: t("message.branchUnavailable") }),
    clock === "end" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: MessageIconActions_default.endInfo, children: [
      usageAction,
      clockEl
    ] }) : usageAction
  ] });
}

// chat/MessageItem.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function contentParts(content) {
  const texts = [];
  const attachments = [];
  const rest = [];
  for (const block of content) {
    const b = block;
    if (b.type === "text" && typeof b.text === "string") texts.push(b.text);
    else if (b.type === "image" && b.attachment !== void 0) {
      attachments.push({ type: "image", image: { attachment: b.attachment } });
    } else if (b.type === "file" && b.attachment !== void 0) {
      attachments.push({ type: "file", file: b.attachment });
    } else rest.push(block);
  }
  return { text: texts.join(""), attachments, rest };
}
function retrySeconds(milliseconds) {
  return Math.max(1, Math.ceil(milliseconds / 1e3));
}
function failureMessage(message, code, t) {
  return code === "AUTH" ? t("message.failure.auth") : message;
}
function ModelRetryItem({ node, active, t }) {
  const deadline = (0, import_react5.useMemo)(() => Date.now() + node.delayMs, [node.delayMs, node.seq]);
  const scheduledSeconds = retrySeconds(node.delayMs);
  const maximum = node.mode === "normal" ? node.maxRetries : "\u221E";
  const [countdown, setCountdown] = (0, import_react5.useState)(() => ({
    deadline,
    seconds: retrySeconds(deadline - Date.now())
  }));
  const remainingSeconds = countdown.deadline === deadline ? countdown.seconds : retrySeconds(deadline - Date.now());
  (0, import_react5.useEffect)(() => {
    if (!active) return;
    const updateCountdown = () => {
      const next = retrySeconds(deadline - Date.now());
      setCountdown((current) => current.deadline === deadline && current.seconds === next ? current : { deadline, seconds: next });
      return next;
    };
    if (updateCountdown() === 1) return;
    const timer = window.setInterval(() => {
      if (updateCountdown() === 1) window.clearInterval(timer);
    }, 250);
    return () => {
      window.clearInterval(timer);
    };
  }, [active, deadline]);
  const label = active ? t("message.retry.active") : node.retryState === "cancelled" ? t("message.retry.cancelled") : node.retryState === "started" ? t("message.retry.started") : t("message.retry.scheduled");
  const seconds = active ? remainingSeconds : scheduledSeconds;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("details", { className: MessageItem_default.retryRow, "data-active": active || void 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("summary", { className: MessageItem_default.retrySummary, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: MessageItem_default.retryText, role: "status", children: t("message.retry.status", { label, retry: node.retry, maximum, seconds }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: MessageItem_default.retryDetails, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: MessageItem_default.retryDetailLabel, children: t("message.retry.delay") }),
        t("duration.milliseconds", { milliseconds: Math.round(node.delayMs) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: MessageItem_default.retryDetailLabel, children: t("message.retry.failure") }),
        failureMessage(node.failure.message, node.failure.code, t)
      ] })
    ] })
  ] });
}
function TurnErrorItem({ node, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: MessageItem_default.turnErrorRow, role: "status", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives5.StateDot, { state: "error", className: MessageItem_default.turnErrorDot }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: MessageItem_default.turnErrorCopy, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: MessageItem_default.turnErrorTitle, children: t("message.turnError") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: MessageItem_default.turnErrorMessage, children: failureMessage(node.message, node.code, t) })
    ] }),
    node.code !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("code", { className: MessageItem_default.turnErrorCode, children: node.code })
  ] });
}
function TurnMaxTokensItem({ t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: MessageItem_default.turnErrorRow, role: "status", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives5.StateDot, { state: "warning", className: MessageItem_default.turnErrorDot }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: MessageItem_default.turnErrorCopy, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: MessageItem_default.maxTokensTitle, children: t("message.maxTokens") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: MessageItem_default.turnErrorMessage, children: t("message.maxTokens.hint") })
    ] })
  ] });
}
function UserStyleBubble({
  content,
  renderMessageImages,
  actions,
  pending = false,
  echo = false,
  referenceLabels = [],
  skillNames = [],
  previewAttachments,
  references,
  t
}) {
  const { text, attachments: contentAttachments, rest } = contentParts(content);
  const attachments = previewAttachments ?? contentAttachments;
  const compactImages = attachments.length > 1;
  const truncated = (total) => t("json.truncated", { total });
  const showBubble = text !== "" || rest.length > 0;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      className: MessageItem_default.userRow,
      "data-pending-steering": pending || void 0,
      "data-submission-echo": echo || void 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: MessageItem_default.userStack, children: [
          attachments.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: MessageItem_default.attachmentRow, "data-message-attachments": true, children: attachments.map((attachment, index) => attachment.type === "image" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_react5.Fragment, { children: renderMessageImages({
            images: [attachment.image],
            align: "end",
            compact: compactImages
          }) }, `image:${index}`) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: MessageItem_default.fileCard, title: attachment.file.name, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives5.FileTypeIcon, { path: attachment.file.name, className: MessageItem_default.fileIcon }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: MessageItem_default.fileContent, children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: MessageItem_default.fileName, children: attachment.file.name }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: MessageItem_default.fileMeta, children: [(0, import_dsh_client_ui_primitives5.fileExtension)(attachment.file.name).toUpperCase().slice(0, 8), (0, import_dsh_client_ui_primitives5.fileSizeText)(attachment.file.bytes)].filter(Boolean).join(" ") })
            ] })
          ] }, `file:${index}`)) }),
          showBubble && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: MessageItem_default.bubble, children: [
            (0, import_dsh_client_ui_primitives5.projectUserText)(text, referenceLabels, skillNames, "skill", references),
            rest.map((block, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives5.JsonBlock, { label: t("message.extraBlock"), payload: block, truncatedLabel: truncated }, i))
          ] }),
          referenceLabels.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: MessageItem_default.referenceSummary, children: t("message.referenceSummary", { labels: referenceLabels.join(t("message.referenceSeparator")) }) })
        ] }),
        actions?.(text)
      ]
    }
  );
}
function PendingSteeringBubble({ content, renderMessageImages, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    UserStyleBubble,
    {
      content,
      renderMessageImages,
      pending: true,
      t,
      actions: (text) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        MessageIconActions,
        {
          text,
          clock: "start",
          className: MessageItem_default.actions,
          t
        }
      )
    }
  );
}
function PendingSubmissionBubble({ submission, renderMessageImages, t }) {
  const content = (0, import_react5.useMemo)(
    () => submission.text === "" ? [] : [{ type: "text", text: submission.text }],
    [submission.text]
  );
  const previewAttachments = (0, import_react5.useMemo)(
    () => submission.attachments.map((attachment) => attachment.type === "image" ? {
      type: "image",
      image: {
        preview: {
          url: attachment.value.previewUrl,
          ...attachment.value.name === void 0 ? {} : { name: attachment.value.name },
          ...attachment.value.width === void 0 ? {} : { width: attachment.value.width },
          ...attachment.value.height === void 0 ? {} : { height: attachment.value.height }
        }
      }
    } : { type: "file", file: attachment.value }),
    [submission.attachments]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    UserStyleBubble,
    {
      content,
      previewAttachments,
      renderMessageImages,
      pending: submission.placement === "steering",
      echo: true,
      t,
      actions: (text) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        MessageIconActions,
        {
          text,
          time: submission.time,
          clock: "start",
          className: MessageItem_default.actions,
          t
        }
      )
    }
  );
}
var UserMessageNodeView = (0, import_react5.memo)(function UserMessageNodeView2(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(UserMessageBubble, { ...props, extraActions: (text) => props.renderSlot("conversation.chat.user-actions", {
    seq: props.node.data.seq,
    text
  }) });
});
var SteeringMessageNodeView = (0, import_react5.memo)(function SteeringMessageNodeView2(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(UserMessageBubble, { ...props });
});
function UserMessageBubble({ node, renderMessageImages, openFile, openSkill, extraActions, t }) {
  const data = node.data;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    UserStyleBubble,
    {
      content: data.content,
      references: { openFile, openSkill },
      renderMessageImages,
      ...data.referenceLabels === void 0 ? {} : { referenceLabels: data.referenceLabels },
      ...data.skillNames === void 0 ? {} : { skillNames: data.skillNames },
      t,
      actions: (text) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        MessageIconActions,
        {
          text,
          time: data.time,
          clock: "start",
          className: MessageItem_default.actions,
          extraActions: extraActions?.(text),
          t
        }
      )
    }
  );
}
var ContextMessageNodeView = (0, import_react5.memo)(function ContextMessageNodeView2({ node, t }) {
  const data = node.data;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    ContextInjectionRow,
    {
      content: data.content,
      source: data.source,
      producer: data.producer,
      form: data.form,
      t
    }
  );
});
var CompactionNodeView = (0, import_react5.memo)(function CompactionNodeView2({ node, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CompactionItem, { node: node.data, t });
});
var RetryNodeView = (0, import_react5.memo)(function RetryNodeView2({ node, t }) {
  const data = node.data;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ModelRetryItem, { node: data.current, active: data.current.retryState === "scheduled", t });
});
var TurnErrorNodeView = (0, import_react5.memo)(function TurnErrorNodeView2({ node, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TurnErrorItem, { node: node.data, t });
});
var TurnMaxTokensNodeView = (0, import_react5.memo)(function TurnMaxTokensNodeView2({ t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TurnMaxTokensItem, { t });
});
var UnknownNodeView = (0, import_react5.memo)(function UnknownNodeView2({ node, t }) {
  const data = node.data;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: MessageItem_default.contextRow, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    import_dsh_client_ui_primitives5.JsonBlock,
    {
      label: t("message.unknownSurface", { type: data.type }),
      payload: data.data,
      truncatedLabel: (total) => t("json.truncated", { total })
    }
  ) });
});

// chat/ChatNodeSeat.tsx
var import_react7 = require("react");
var import_dsh_client_ui_primitives6 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");

// contract/turn-process.ts
var TURN_PROCESS_INDEPENDENT_KIND_LIST = [
  "system-prompt",
  "user",
  "steering",
  "turn-trigger",
  "turn-process",
  "turn-error",
  "turn-max-tokens",
  "turn-tail"
];
var TURN_PROCESS_INDEPENDENT_KINDS = new Set(
  TURN_PROCESS_INDEPENDENT_KIND_LIST
);
function sameTurnProcessSpec(left, right) {
  return left.turn === right.turn && left.controlAnchorSeq === right.controlAnchorSeq && left.processStartSeq === right.processStartSeq && left.answerAnchorSeq === right.answerAnchorSeq && left.answerStep === right.answerStep && left.maintenanceStartSeq === right.maintenanceStartSeq && left.inlineReasoning === right.inlineReasoning && left.messageCount === right.messageCount && left.toolCallCount === right.toolCallCount && left.subagentCount === right.subagentCount;
}
function turnProcessMember(node, spec) {
  if (TURN_PROCESS_INDEPENDENT_KINDS.has(node.kind) && !(node.kind === "system-prompt" && spec.maintenanceStartSeq !== null)) return false;
  return node.anchorSeq >= spec.processStartSeq && (spec.answerAnchorSeq === null || node.anchorSeq < spec.answerAnchorSeq || spec.maintenanceStartSeq !== null && node.anchorSeq >= spec.maintenanceStartSeq);
}
function isSubagentDelegationTool(name) {
  return name === "subagent" || name.startsWith("subagent_");
}
function turnProcessAlwaysOpen(node) {
  const location = node?.location;
  if (location?.kind !== "turn" && location?.kind !== "step") return false;
  const reason = location.turn.end?.data.reason.kind;
  return location.turn.status === "open" || reason === "aborted" || reason === "error";
}

// stores.ts
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function storedTurnProcessEntry(state, turn) {
  return state.turnProcesses.find((entry) => entry.turn === turn);
}
function createChatStore() {
  return (0, import_dsh_client_store.defineStore)({
    init: () => ({ turnProcesses: [] }),
    actions: {
      setTurnProcessOpen: (draft, turn, answerStep, open) => {
        const index = draft.turnProcesses.findIndex((entry) => entry.turn === turn);
        if (!open) {
          if (index >= 0) draft.turnProcesses.splice(index, 1);
          return;
        }
        const next = { turn, answerStep };
        if (index < 0) draft.turnProcesses.push(next);
        else draft.turnProcesses[index] = next;
      }
    }
  });
}

// chat/searchable-hidden.ts
var import_react6 = require("react");
function useSearchableHidden(hidden, reveal) {
  const ref = (0, import_react6.useRef)(null);
  (0, import_react6.useLayoutEffect)(() => {
    const element = ref.current;
    if (element === null) return;
    if (hidden && element.contains(element.ownerDocument.activeElement)) {
      reveal();
      return;
    }
    if (hidden) element.setAttribute("hidden", "until-found");
    else element.removeAttribute("hidden");
  }, [hidden, reveal]);
  (0, import_react6.useEffect)(() => {
    const element = ref.current;
    if (element === null) return;
    element.addEventListener("beforematch", reveal);
    return () => {
      element.removeEventListener("beforematch", reveal);
    };
  }, [reveal]);
  return ref;
}

// chat/ChatView.module.css
var owner5 = "dsh-nexttavern-ui-chat";
var key5 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/ChatView.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key5)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner5;
  style.dataset.pluginCss = key5;
  style.textContent = ".febj9G_root{flex-direction:column;flex:auto;min-height:0;display:flex;position:relative}.febj9G_scroll{min-height:0;padding:16px calc(var(--dsh-composer-side-clearance) + 16px);flex:auto;overflow-y:auto;container-type:inline-size}.febj9G_root[data-chat-following-tail] .febj9G_scroll,[data-conversation-scroll]:has(.febj9G_root[data-chat-following-tail]){overflow-anchor:none}[data-conversation-scroll] .febj9G_root{flex:none;height:auto;min-height:auto}[data-conversation-scroll] .febj9G_scroll{flex:none;min-height:auto;overflow:visible}.febj9G_column{max-width:var(--dsh-chat-content-width);flex-direction:column;width:100%;margin:0 auto;display:flex}.febj9G_column>:not([hidden]):not(.febj9G_flowItem:empty)~:not([hidden]):not(.febj9G_flowItem:empty){margin-top:var(--dsh-chat-flow-gap,16px)}.febj9G_flowItem{min-width:0}.febj9G_flowItem[data-turn-process-answer]{--dsh-chat-flow-gap:8px}.febj9G_flowItem:empty{height:0}.febj9G_callRow{border-radius:6px}.febj9G_hint{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px))}.febj9G_openError{color:var(--dsw-alias-state-error-primary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px))}.febj9G_older{justify-content:center;display:flex}.febj9G_older button{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover-solid);cursor:pointer;border:none;border-radius:14px;padding:4px 12px;font-size:12px}.febj9G_older button:disabled{cursor:default;opacity:.6}.febj9G_toBottomSlot{z-index:8;height:0;padding-right:max(0px, calc((100% - var(--dsh-chat-content-width)) / 2));pointer-events:none;justify-content:flex-end;display:flex;position:sticky;bottom:16px}[data-conversation-scroll] .febj9G_toBottomSlot{bottom:calc(var(--dsh-composer-height,152px) + 16px)}.febj9G_toBottom{--dsw-elevation-stroke-color:var(--dsw-alias-border-l3);corner-shape:round;width:34px;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-button-floating-fill);box-shadow:var(--dsw-elevation-panel);cursor:pointer;pointer-events:auto;border:0;border-radius:100px;justify-content:center;align-items:center;margin-top:-34px;padding:0;display:flex}.febj9G_toBottom:hover{background:var(--dsw-alias-button-floating-hover)}.febj9G_modalAction{min-width:72px}";
  document.head.appendChild(style);
}
var ChatView_default = { "callRow": "febj9G_callRow", "column": "febj9G_column", "flowItem": "febj9G_flowItem", "hint": "febj9G_hint", "modalAction": "febj9G_modalAction", "older": "febj9G_older", "openError": "febj9G_openError", "root": "febj9G_root", "scroll": "febj9G_scroll", "toBottom": "febj9G_toBottom", "toBottomSlot": "febj9G_toBottomSlot" };

// chat/ChatNodeSeat.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function turnDataOf(node) {
  const location = node?.location;
  return location?.kind === "turn" || location?.kind === "step" ? location.turn.data : void 0;
}
function turnOf(node) {
  const location = node?.location;
  return location?.kind === "turn" || location?.kind === "step" ? location.turn.turn : void 0;
}
var ChatNodeSeat = (0, import_react7.memo)(function ChatNodeSeat2({
  nodeKey,
  groupPart,
  useChatNode,
  useChatNodeProcess,
  usePresentation,
  cwd,
  openFile,
  openSkill,
  inspectCall,
  forkAt,
  loadImage,
  renderMessageImages,
  fileMentions,
  useStore,
  actions,
  renderSlot,
  t
}) {
  const node = useChatNode(nodeKey);
  const routedNode = node;
  const turn = turnOf(routedNode);
  const processPresentation = useChatNodeProcess(nodeKey);
  const processSpec2 = processPresentation?.spec;
  const storedEntry = useStore((state) => processSpec2 === void 0 ? void 0 : storedTurnProcessEntry(state, processSpec2.turn));
  const processEntry = processSpec2 !== void 0 && storedEntry?.answerStep === (processSpec2.answerStep ?? 0) ? storedEntry : void 0;
  const liveProcess = processPresentation !== void 0 && !processPresentation.turnClosed;
  const interleavedInput = processPresentation?.hasInterleavedInput === true;
  const alwaysOpen = liveProcess || interleavedInput || turnProcessAlwaysOpen(routedNode);
  const processOpen = alwaysOpen || processEntry !== void 0;
  const setOpen = (0, import_react7.useCallback)((open) => {
    if (processSpec2 !== void 0 && !alwaysOpen) {
      actions.setTurnProcessOpen(processSpec2.turn, processSpec2.answerStep ?? 0, open);
    }
  }, [actions, processSpec2, alwaysOpen]);
  const foldCompleted = usePresentation((policy) => policy.foldCompletedTurns);
  const processWindowReady = processSpec2 !== void 0 && processPresentation !== void 0 && foldCompleted && processPresentation.turn === processSpec2.turn && (processPresentation.turnStarted || processPresentation.turnClosed);
  const processMember = routedNode !== void 0 && processWindowReady && (turnProcessMember(routedNode, processSpec2) || liveProcess && !TURN_PROCESS_INDEPENDENT_KINDS.has(routedNode.kind) && routedNode.anchorSeq >= processSpec2.processStartSeq || groupPart === "reasoning" && routedNode.kind === "assistant-step" && routedNode.data.step === processSpec2.answerStep);
  const processAnswer = routedNode !== void 0 && processWindowReady && !liveProcess && groupPart !== "reasoning" && routedNode.kind === "assistant-step" && routedNode.data.step === processSpec2.answerStep;
  const ownsDisclosure = routedNode?.kind === "turn-process" || processAnswer;
  const foldable = processWindowReady && (liveProcess || processMember || ownsDisclosure);
  const turnProcess = (0, import_react7.useMemo)(() => processSpec2 === void 0 ? void 0 : {
    spec: processSpec2,
    foldable,
    hasContent: !interleavedInput && (processPresentation?.hasExternalProcess === true || processSpec2.inlineReasoning),
    open: processOpen,
    setOpen
  }, [
    foldable,
    interleavedInput,
    processOpen,
    processSpec2,
    processPresentation?.hasExternalProcess,
    setOpen
  ]);
  const controllerInactive = routedNode?.kind === "turn-process" && !foldable;
  const compactAnswer = processAnswer && foldable && processPresentation.compactAnswer && !processOpen;
  const processHidden = controllerInactive || foldable && processMember && !processOpen;
  const revealProcess = (0, import_react7.useCallback)(() => {
    if (processMember) setOpen(true);
  }, [processMember, setOpen]);
  const wrapperRef = useSearchableHidden(processHidden, revealProcess);
  const [disclosureReset] = (0, import_react7.useState)(() => (0, import_dsh_client_store2.createSnapshotStore)(0));
  const turnData = turnDataOf(routedNode);
  const hookContext = (0, import_react7.useMemo)(() => ({ turnData, disclosureReset }), [turnData, disclosureReset]);
  (0, import_react7.useEffect)(() => {
    if (processMember && processHidden && wrapperRef.current?.hasAttribute("hidden")) {
      disclosureReset.set(disclosureReset.getSnapshot() + 1);
    }
  }, [processMember, processHidden, wrapperRef, disclosureReset]);
  const owner19 = (0, import_react7.useMemo)(() => node === void 0 ? null : {
    ...groupPart === void 0 ? {} : { groupPart },
    cwd,
    openFile,
    openSkill,
    inspectCall,
    forkAt,
    loadImage,
    renderMessageImages,
    fileMentions,
    turnProcess
  }, [
    node,
    groupPart,
    cwd,
    openFile,
    openSkill,
    inspectCall,
    forkAt,
    loadImage,
    renderMessageImages,
    fileMentions,
    turnProcess
  ]);
  if (routedNode === void 0 || owner19 === null) return null;
  const routedOwner = { ...owner19, node: routedNode };
  const flowKey = groupPart === void 0 || groupPart === "response" ? routedNode.key : JSON.stringify([routedNode.key, groupPart]);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "div",
    {
      ref: wrapperRef,
      className: ChatView_default.flowItem,
      "data-chat-anchor-key": flowKey,
      "data-chat-flow-key": flowKey,
      "data-chat-paging-anchor": routedNode.kind !== "turn-process" || void 0,
      "data-chat-node-key": routedNode.key,
      "data-chat-group-part": groupPart,
      "data-chat-flow-kind": routedNode.kind,
      "data-chat-turn": turn,
      "data-turn-process-member": processMember || void 0,
      "data-turn-process-hidden": processHidden || void 0,
      "data-turn-process-answer": compactAnswer || void 0,
      children: renderSlot("conversation.chat.node", routedOwner, {
        entryKey: routedNode.kind,
        hookContext,
        fallback: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          import_dsh_client_ui_primitives6.JsonBlock,
          {
            label: t("message.unknownSurface", { type: routedNode.kind }),
            payload: routedNode.data,
            truncatedLabel: (total) => t("json.truncated", { total })
          }
        )
      })
    }
  );
});

// chat/ChatGroupSeat.tsx
var import_react9 = require("react");
var import_dsh_client_ui_primitives7 = require("@deepseek-ai/dsh-client-ui-primitives");

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-util-values/lib/index.js
function assertNever(value, context) {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}

// chat/render-entry.ts
function chatRenderKey(entry) {
  switch (entry.kind) {
    case "node":
      return JSON.stringify(["node", entry.key, entry.groupPart ?? null]);
    case "group":
      return JSON.stringify(["group", entry.key]);
    default:
      return assertNever(entry);
  }
}

// chat/step-process.ts
function processTitle(summary, t) {
  const labels = summary.counts.slice(0, 3).map(({ kind }) => t(`message.stepProcess.done.${kind}`));
  const first = labels[0];
  if (first === void 0) return t("message.stepProcess.done.thinking");
  const continuation = (label) => label.charAt(0).toLowerCase() + label.slice(1);
  const second = labels[1];
  if (second === void 0) return first;
  if (labels.length === 2) {
    const prefix = t("message.stepProcess.sharedPrefix");
    const shared = prefix !== "" && first.startsWith(prefix) && second.startsWith(prefix);
    return t("message.stepProcess.joinTwo", { first, second: continuation(shared ? second.slice(prefix.length) : second) });
  }
  const title = [first, ...labels.slice(1).map(continuation)].join(t("message.stepProcess.comma"));
  return summary.counts.length > 3 ? t("message.stepProcess.more", { title }) : title;
}

// chat/use-disclosure.ts
var import_react8 = require("react");
function useDisclosure(version = 0) {
  const [expandedVersion, setExpandedVersion] = (0, import_react8.useState)(null);
  const expanded = expandedVersion === version;
  const setExpanded = (0, import_react8.useCallback)((open) => {
    setExpandedVersion(open ? version : null);
  }, [version]);
  const toggle = (0, import_react8.useCallback)(() => {
    setExpandedVersion((previous) => previous === version ? null : version);
  }, [version]);
  return { expanded, setExpanded, toggle };
}
function bindDisclosure(reset) {
  const subscribe = (listener) => reset.subscribe(listener);
  const getSnapshot = () => reset.getSnapshot();
  return function useBoundDisclosure() {
    const version = (0, import_react8.useSyncExternalStore)(subscribe, getSnapshot);
    return useDisclosure(version);
  };
}

// chat/ChatGroupSeat.module.css
var owner6 = "dsh-nexttavern-ui-chat";
var key6 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/ChatGroupSeat.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key6)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner6;
  style.dataset.pluginCss = key6;
  style.textContent = ".ER0QMG_root{min-width:0}.ER0QMG_title{max-width:100%;color:var(--dsw-alias-label-secondary);font:inherit;font-size:var(--dsh-content-font-size,14px);text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:6px;padding:0;transition:color .1s;display:flex}.ER0QMG_title:hover{color:var(--dsw-alias-label-primary)}.ER0QMG_leading{width:16px;height:16px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;display:inline-flex;position:relative}.ER0QMG_activityIcon,.ER0QMG_chevron{justify-content:center;align-items:center;transition:opacity .1s;display:inline-flex;position:absolute;inset:0}.ER0QMG_activityIcon{opacity:1}.ER0QMG_chevron,.ER0QMG_title:is(:hover,:focus-visible) .ER0QMG_activityIcon{opacity:0}.ER0QMG_title:is(:hover,:focus-visible) .ER0QMG_chevron{opacity:1}.ER0QMG_title[aria-expanded=true] .ER0QMG_activityIcon{opacity:0}.ER0QMG_title[aria-expanded=true] .ER0QMG_chevron{opacity:1}.ER0QMG_title[aria-expanded=true]{padding-bottom:16px}.ER0QMG_body{--dsh-chat-flow-gap:8px;overscroll-behavior-y:auto;scrollbar-gutter:stable;max-height:min(400px,50vh);overflow-y:auto}.ER0QMG_label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.ER0QMG_fadeTop{mask-image:linear-gradient(#0000 0,#000 24px 100%)}.ER0QMG_fadeBottom{mask-image:linear-gradient(#000 0 calc(100% - 24px),#0000 100%)}.ER0QMG_fadeTop.ER0QMG_fadeBottom{mask-image:linear-gradient(#0000 0,#000 24px calc(100% - 24px),#0000 100%)}@media (prefers-reduced-motion:reduce){.ER0QMG_title,.ER0QMG_activityIcon,.ER0QMG_chevron{transition:none}}.ER0QMG_content{flex-direction:column;display:flex}.ER0QMG_content>*{flex-shrink:0}.ER0QMG_content>:not([hidden]):not(:empty)~:not([hidden]):not(:empty){margin-top:var(--dsh-chat-flow-gap,8px)}.ER0QMG_expandedBody{--dsh-chat-flow-gap:16px;scrollbar-gutter:auto;max-height:none;overflow:visible}";
  document.head.appendChild(style);
}
var ChatGroupSeat_default = { "activityIcon": "ER0QMG_activityIcon", "body": "ER0QMG_body", "chevron": "ER0QMG_chevron", "content": "ER0QMG_content", "expandedBody": "ER0QMG_expandedBody", "fadeBottom": "ER0QMG_fadeBottom", "fadeTop": "ER0QMG_fadeTop", "label": "ER0QMG_label", "leading": "ER0QMG_leading", "root": "ER0QMG_root", "title": "ER0QMG_title" };

// chat/ChatGroupSeat.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var import_react10 = require("react");
var PROCESS_SCROLL_AT_REST = { canScrollUp: false, canScrollDown: false };
var PROCESS_TITLE_MINIMUM_MS = 150;
var PROCESS_ICONS = {
  thinking: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconThinkOutlineRegular, {}),
  read: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconBrowseOutlineRegular, { size: 14 }),
  search: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconSearchOutlineRegular, { size: 14 }),
  edit: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconEditOutlineRegular, { size: 14 }),
  commands: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconApiOutlineRegular, {}),
  code: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconCodeOutlineRegular, { size: 14 }),
  webSearch: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconGlobeOutlineRegular, {}),
  webFetch: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconBrowseOutlineRegular, { size: 14 }),
  subagents: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconAgentPresetOutlineRegular, { size: 14 }),
  plan: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconPlanOutlineRegular, {}),
  questions: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconQuestionOutlineRegular, {}),
  tools: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconSparkleRegular, { size: 14 })
};
function processScrollEdges(element) {
  return {
    canScrollUp: element.scrollTop > 1,
    canScrollDown: element.scrollTop < element.scrollHeight - element.clientHeight - 1
  };
}
function sameProcessScrollEdges(left, right) {
  return left.canScrollUp === right.canScrollUp && left.canScrollDown === right.canScrollDown;
}
function sameLiveProcessTitle(left, right) {
  return left.activity === right.activity && left.detail === right.detail;
}
function useStableLiveProcessTitle(desired, active) {
  const [displayed, setDisplayed] = (0, import_react9.useState)(desired);
  const displayedRef = (0, import_react9.useRef)(displayed);
  const desiredRef = (0, import_react9.useRef)(desired);
  const displayedAtRef = (0, import_react9.useRef)(Date.now());
  (0, import_react9.useEffect)(() => {
    desiredRef.current = desired;
    if (!active || sameLiveProcessTitle(displayedRef.current, desired)) return;
    const remaining = PROCESS_TITLE_MINIMUM_MS - (Date.now() - displayedAtRef.current);
    const commit = () => {
      const next = desiredRef.current;
      displayedRef.current = next;
      displayedAtRef.current = Date.now();
      setDisplayed(next);
    };
    if (remaining <= 0) {
      commit();
      return;
    }
    const timer = setTimeout(commit, remaining);
    return () => {
      clearTimeout(timer);
    };
  }, [active, desired.activity, desired.detail]);
  return active ? displayed : desired;
}
var GroupMembers = (0, import_react9.memo)(function GroupMembers2({ members, ...props }) {
  return members.map((member) => /* @__PURE__ */ (0, import_react10.createElement)(
    ChatNodeSeat,
    {
      ...props,
      key: chatRenderKey(member),
      nodeKey: member.key,
      ...member.groupPart === void 0 ? {} : { groupPart: member.groupPart }
    }
  ));
});
var ProcessGroupHeader = (0, import_react9.memo)(function ProcessGroupHeader2({ groupKey, useChatGroup, usePresentation, t, open, bodyId, toggle }) {
  const data = useChatGroup(groupKey, (group) => group?.data);
  const detailed = usePresentation((policy) => data?.closed === false && policy.liveProcessDetail);
  const live = useStableLiveProcessTitle({
    activity: data?.summary.running ?? "thinking",
    detail: data?.summary.runningDetail ?? ""
  }, data !== void 0 && !data.closed);
  if (data === void 0) return null;
  const label = data.closed ? processTitle(data.summary, t) : t(`message.stepProcess.${live.activity}`);
  const detail = detailed && !data.closed ? live.detail : "";
  const title = detail === "" ? label : `${label}${t("message.turnProcess.separator")}${detail}`;
  const activity2 = data.closed ? data.summary.counts[0]?.kind ?? "thinking" : live.activity;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "button",
    {
      type: "button",
      className: ChatGroupSeat_default.title,
      "aria-expanded": open,
      "aria-controls": bodyId,
      "data-process-activity": activity2,
      onClick: (event) => {
        event.currentTarget.focus();
        toggle();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: ChatGroupSeat_default.leading, "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: ChatGroupSeat_default.activityIcon, "data-step-process-icon": true, children: PROCESS_ICONS[activity2] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: ChatGroupSeat_default.chevron, "data-step-process-chevron": true, children: open ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconChevronUpOutlineRegular, {}) : /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.IconChevronDownOutlineRegular, {}) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_dsh_client_ui_primitives7.TextShimmer, { active: !data.closed, className: ChatGroupSeat_default.label, children: title })
      ]
    }
  );
});
var ChatGroupSeat = (0, import_react9.memo)(function ChatGroupSeat2({ groupKey, useChatGroup, ...props }) {
  const members = useChatGroup(groupKey, (group) => group?.members);
  const turn = useChatGroup(groupKey, (group) => group?.data.turn);
  const foldCompleted = props.usePresentation((policy) => policy.foldCompletedTurns);
  const { expanded: open, setExpanded: setOpen, toggle } = useDisclosure();
  const firstKey = members?.[0]?.key ?? "";
  const presentation = props.useChatNodeProcess(firstKey);
  const turnLocation3 = props.useChatNode(firstKey, (node) => {
    const location = node?.location;
    return location?.kind === "turn" || location?.kind === "step" ? location.turn : void 0;
  });
  const grouped = props.usePresentation((policy) => turnLocation3?.status !== "open" || policy.stepGrouping !== "none");
  const reason = turnLocation3?.end?.data.reason.kind;
  const alwaysOpen = presentation?.turnClosed === false || presentation?.hasInterleavedInput === true || reason === "aborted" || reason === "error";
  const spec = presentation?.spec;
  const selectStored = (0, import_react9.useCallback)((state) => turn === void 0 ? void 0 : storedTurnProcessEntry(state, turn), [turn]);
  const stored = props.useStore(selectStored);
  const outerHidden = foldCompleted && presentation?.turnClosed === true && spec !== void 0 && !alwaysOpen && stored?.answerStep !== (spec.answerStep ?? 0);
  const revealOuter = (0, import_react9.useCallback)(() => {
    if (spec !== void 0 && !alwaysOpen) props.actions.setTurnProcessOpen(spec.turn, spec.answerStep ?? 0, true);
  }, [props.actions, spec, alwaysOpen]);
  const rootRef = useSearchableHidden(outerHidden, revealOuter);
  (0, import_react9.useEffect)(() => {
    if (outerHidden && rootRef.current?.hasAttribute("hidden")) setOpen(false);
  }, [outerHidden, rootRef, setOpen]);
  const reveal = (0, import_react9.useCallback)(() => {
    setOpen(true);
  }, [setOpen]);
  const bodyRef = useSearchableHidden(grouped && !open, reveal);
  const contentRef = (0, import_react9.useRef)(null);
  const bodyId = (0, import_react9.useId)();
  const [edges, setEdges] = (0, import_react9.useState)(PROCESS_SCROLL_AT_REST);
  const sync = (0, import_react9.useCallback)(() => {
    const body = bodyRef.current;
    const next = body === null || body.closest("[hidden], [data-group-expanded-mode]") !== null ? PROCESS_SCROLL_AT_REST : processScrollEdges(body);
    setEdges((previous) => sameProcessScrollEdges(previous, next) ? previous : next);
  }, [bodyRef]);
  (0, import_react9.useLayoutEffect)(() => {
    const body = bodyRef.current;
    if (body === null || !open || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(body);
    if (contentRef.current !== null) observer.observe(contentRef.current);
    return () => {
      observer.disconnect();
    };
  }, [bodyRef, open, sync]);
  if (members === void 0) return null;
  const classes = [
    ChatGroupSeat_default.body,
    !grouped ? ChatGroupSeat_default.expandedBody : "",
    grouped && edges.canScrollUp ? ChatGroupSeat_default.fadeTop : "",
    grouped && edges.canScrollDown ? ChatGroupSeat_default.fadeBottom : ""
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "div",
    {
      ref: rootRef,
      className: ChatGroupSeat_default.root,
      "data-chat-group-key": groupKey,
      "data-chat-flow-key": groupKey,
      "data-chat-anchor-key": `group:${groupKey}`,
      "data-chat-turn": turn,
      "data-chat-paging-anchor": grouped && !open || void 0,
      "data-step-process": true,
      "data-group-expanded-mode": !grouped || void 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { hidden: !grouped, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          ProcessGroupHeader,
          {
            groupKey,
            useChatGroup,
            usePresentation: props.usePresentation,
            t: props.t,
            open,
            bodyId,
            toggle
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "div",
          {
            ref: bodyRef,
            id: bodyId,
            className: classes.join(" "),
            "data-step-process-body": true,
            "data-scroll-up": edges.canScrollUp || void 0,
            "data-scroll-down": edges.canScrollDown || void 0,
            onScroll: sync,
            children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { ref: contentRef, className: ChatGroupSeat_default.content, "data-step-process-content": true, "data-chat-flow": "", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(GroupMembers, { ...props, members }) })
          }
        )
      ]
    }
  );
});

// chat/TurnNavigator.tsx
var import_react11 = require("react");

// ../../../../build-tools/node_modules/@tanstack/react-virtual/dist/esm/index.js
var React = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");

// ../../../../build-tools/node_modules/@tanstack/virtual-core/dist/esm/lazy-measurements.js
function createLazyMeasurementsView(count, flat, getItemKey) {
  const cache = new Array(count);
  return new Proxy(cache, {
    get(target, prop, receiver) {
      if (typeof prop === "string") {
        const c = prop.charCodeAt(0);
        if (c >= 48 && c <= 57) {
          const i = +prop;
          if (Number.isInteger(i) && i >= 0 && i < count) {
            let v = target[i];
            if (!v) {
              const s = flat[i * 2];
              v = target[i] = {
                index: i,
                key: getItemKey(i),
                start: s,
                size: flat[i * 2 + 1],
                end: s + flat[i * 2 + 1],
                lane: 0
              };
            }
            return v;
          }
        }
        if (prop === "length") return count;
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

// ../../../../build-tools/node_modules/@tanstack/virtual-core/dist/esm/utils.js
function memo5(getDeps, fn, opts) {
  let deps = opts.initialDeps ?? [];
  let result;
  let isInitial = true;
  function memoizedFunction() {
    var _a;
    const debugEnabled = !!opts.key && !!((_a = opts.debug) == null ? void 0 : _a.call(opts));
    let depTime = 0;
    if (debugEnabled) depTime = Date.now();
    const newDeps = getDeps();
    const depsChanged = newDeps.length !== deps.length || newDeps.some((dep, index) => deps[index] !== dep);
    if (!depsChanged) {
      return result;
    }
    deps = newDeps;
    let resultTime = 0;
    if (debugEnabled) resultTime = Date.now();
    result = fn(...newDeps);
    if (debugEnabled) {
      const depEndTime = Math.round((Date.now() - depTime) * 100) / 100;
      const resultEndTime = Math.round((Date.now() - resultTime) * 100) / 100;
      const resultFpsPercentage = resultEndTime / 16;
      const pad = (str, num) => {
        str = String(str);
        while (str.length < num) {
          str = " " + str;
        }
        return str;
      };
      console.info(
        `%c\u23F1 ${pad(resultEndTime, 5)} /${pad(depEndTime, 5)} ms`,
        `
            font-size: .6rem;
            font-weight: bold;
            color: hsl(${Math.max(
          0,
          Math.min(120 - 120 * resultFpsPercentage, 120)
        )}deg 100% 31%);`,
        opts == null ? void 0 : opts.key
      );
    }
    if ((opts == null ? void 0 : opts.onChange) && !(isInitial && opts.skipInitialOnChange)) {
      opts.onChange(result);
    }
    isInitial = false;
    return result;
  }
  memoizedFunction.updateDeps = (newDeps) => {
    deps = newDeps;
  };
  return memoizedFunction;
}
function notUndefined(value, msg) {
  if (value === void 0) {
    throw new Error(`Unexpected undefined${msg ? `: ${msg}` : ""}`);
  } else {
    return value;
  }
}
var approxEqual = (a, b) => Math.abs(a - b) < 1.01;
var debounce = (targetWindow, fn, ms) => {
  let timeoutId;
  return function(...args) {
    targetWindow.clearTimeout(timeoutId);
    timeoutId = targetWindow.setTimeout(() => fn.apply(this, args), ms);
  };
};

// ../../../../build-tools/node_modules/@tanstack/virtual-core/dist/esm/index.js
var _isIOSResult;
var isIOSWebKit = () => {
  if (_isIOSResult !== void 0) return _isIOSResult;
  if (typeof navigator === "undefined") return _isIOSResult = false;
  if (/iP(hone|od|ad)/.test(navigator.userAgent)) return _isIOSResult = true;
  const mtp = navigator.maxTouchPoints;
  return _isIOSResult = navigator.platform === "MacIntel" && mtp !== void 0 && mtp > 0;
};
var getRect = (element) => {
  const { offsetWidth, offsetHeight } = element;
  return { width: offsetWidth, height: offsetHeight };
};
var defaultKeyExtractor = (index) => index;
var defaultRangeExtractor = (range) => {
  const start = Math.max(range.startIndex - range.overscan, 0);
  const end = Math.min(range.endIndex + range.overscan, range.count - 1);
  const len = end - start + 1;
  const arr = new Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = start + i;
  }
  return arr;
};
var observeElementRect = (instance, cb) => {
  const element = instance.scrollElement;
  if (!element) {
    return;
  }
  const targetWindow = instance.targetWindow;
  if (!targetWindow) {
    return;
  }
  const handler = (rect) => {
    const { width, height } = rect;
    cb({ width: Math.round(width), height: Math.round(height) });
  };
  handler(getRect(element));
  if (!targetWindow.ResizeObserver) {
    return () => {
    };
  }
  const observer = new targetWindow.ResizeObserver((entries) => {
    const run = () => {
      const entry = entries[0];
      if (entry == null ? void 0 : entry.borderBoxSize) {
        const box = entry.borderBoxSize[0];
        if (box) {
          handler({ width: box.inlineSize, height: box.blockSize });
          return;
        }
      }
      handler(getRect(element));
    };
    instance.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
  });
  observer.observe(element, { box: "border-box" });
  return () => {
    observer.unobserve(element);
  };
};
var addEventListenerOptions = {
  passive: true
};
var supportsScrollend = typeof window == "undefined" ? true : "onscrollend" in window;
var observeOffset = (instance, cb, readOffset) => {
  const element = instance.scrollElement;
  if (!element) {
    return;
  }
  const targetWindow = instance.targetWindow;
  if (!targetWindow) {
    return;
  }
  const registerScrollendEvent = instance.options.useScrollendEvent && supportsScrollend;
  let offset = 0;
  const fallback = registerScrollendEvent ? null : debounce(
    targetWindow,
    () => cb(offset, false),
    instance.options.isScrollingResetDelay
  );
  const createHandler = (isScrolling) => () => {
    offset = readOffset(element);
    fallback == null ? void 0 : fallback();
    cb(offset, isScrolling);
  };
  const handler = createHandler(true);
  const endHandler = createHandler(false);
  element.addEventListener("scroll", handler, addEventListenerOptions);
  if (registerScrollendEvent) {
    element.addEventListener("scrollend", endHandler, addEventListenerOptions);
  }
  return () => {
    element.removeEventListener("scroll", handler);
    if (registerScrollendEvent) {
      element.removeEventListener("scrollend", endHandler);
    }
  };
};
var observeElementOffset = (instance, cb) => observeOffset(instance, cb, (el) => {
  const { horizontal, isRtl } = instance.options;
  return horizontal ? el.scrollLeft * (isRtl && -1 || 1) : el.scrollTop;
});
var measureElement = (element, entry, instance) => {
  if (instance.options.useCachedMeasurements) {
    const index = instance.indexFromElement(element);
    const key19 = instance.options.getItemKey(index);
    return instance.itemSizeCache.get(key19) ?? instance.options.estimateSize(index);
  }
  if (entry == null ? void 0 : entry.borderBoxSize) {
    const box = entry.borderBoxSize[0];
    if (box) {
      const size = Math.round(
        box[instance.options.horizontal ? "inlineSize" : "blockSize"]
      );
      return size;
    }
  }
  if (!entry) {
    const index = instance.indexFromElement(element);
    const key19 = instance.options.getItemKey(index);
    const cachedSize = instance.itemSizeCache.get(key19);
    if (cachedSize !== void 0) {
      return cachedSize;
    }
  }
  return element[instance.options.horizontal ? "offsetWidth" : "offsetHeight"];
};
var scrollWithAdjustments = (offset, {
  adjustments = 0,
  behavior
}, instance) => {
  var _a, _b;
  (_b = (_a = instance.scrollElement) == null ? void 0 : _a.scrollTo) == null ? void 0 : _b.call(_a, {
    [instance.options.horizontal ? "left" : "top"]: offset + adjustments,
    behavior
  });
};
var elementScroll = scrollWithAdjustments;
var Virtualizer = class {
  constructor(opts) {
    this.unsubs = [];
    this.scrollElement = null;
    this.targetWindow = null;
    this.isScrolling = false;
    this.scrollState = null;
    this.measurementsCache = [];
    this._flatMeasurements = null;
    this.itemSizeCache = /* @__PURE__ */ new Map();
    this.itemSizeCacheVersion = 0;
    this.laneAssignments = /* @__PURE__ */ new Map();
    this.pendingMin = null;
    this.prevLanes = void 0;
    this.lanesChangedFlag = false;
    this.lanesSettling = false;
    this.pendingScrollAnchor = null;
    this.scrollRect = null;
    this.scrollOffset = null;
    this.scrollDirection = null;
    this.scrollAdjustments = 0;
    this._iosDeferredAdjustment = 0;
    this._iosTouching = false;
    this._iosJustTouchEnded = false;
    this._iosTouchEndTimerId = null;
    this._intendedScrollOffset = null;
    this.elementsCache = /* @__PURE__ */ new Map();
    this.now = () => {
      var _a, _b, _c;
      return ((_c = (_b = (_a = this.targetWindow) == null ? void 0 : _a.performance) == null ? void 0 : _b.now) == null ? void 0 : _c.call(_b)) ?? Date.now();
    };
    this.observer = /* @__PURE__ */ (() => {
      let _ro = null;
      const get = () => {
        if (_ro) {
          return _ro;
        }
        if (!this.targetWindow || !this.targetWindow.ResizeObserver) {
          return null;
        }
        return _ro = new this.targetWindow.ResizeObserver((entries) => {
          entries.forEach((entry) => {
            const run = () => {
              const node = entry.target;
              const index = this.indexFromElement(node);
              if (!node.isConnected) {
                this.observer.unobserve(node);
                for (const [cacheKey, cachedNode] of this.elementsCache) {
                  if (cachedNode === node) {
                    this.elementsCache.delete(cacheKey);
                    break;
                  }
                }
                return;
              }
              if (this.shouldMeasureDuringScroll(index)) {
                this.resizeItem(
                  index,
                  this.options.measureElement(node, entry, this)
                );
              }
            };
            this.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
          });
        });
      };
      return {
        disconnect: () => {
          var _a;
          (_a = get()) == null ? void 0 : _a.disconnect();
          _ro = null;
        },
        observe: (target) => {
          var _a;
          return (_a = get()) == null ? void 0 : _a.observe(target, { box: "border-box" });
        },
        unobserve: (target) => {
          var _a;
          return (_a = get()) == null ? void 0 : _a.unobserve(target);
        }
      };
    })();
    this.range = null;
    this.setOptions = (opts2) => {
      var _a, _b;
      const merged = {
        debug: false,
        initialOffset: 0,
        overscan: 1,
        paddingStart: 0,
        paddingEnd: 0,
        scrollPaddingStart: 0,
        scrollPaddingEnd: 0,
        horizontal: false,
        getItemKey: defaultKeyExtractor,
        rangeExtractor: defaultRangeExtractor,
        onChange: () => {
        },
        measureElement,
        initialRect: { width: 0, height: 0 },
        scrollMargin: 0,
        gap: 0,
        indexAttribute: "data-index",
        initialMeasurementsCache: [],
        lanes: 1,
        anchorTo: "start",
        followOnAppend: false,
        scrollEndThreshold: 1,
        isScrollingResetDelay: 150,
        enabled: true,
        isRtl: false,
        useScrollendEvent: false,
        useAnimationFrameWithResizeObserver: false,
        laneAssignmentMode: "estimate",
        useCachedMeasurements: false
      };
      for (const key19 in opts2) {
        const v = opts2[key19];
        if (v !== void 0) merged[key19] = v;
      }
      const prevOptions = this.options;
      let anchor = null;
      let followOnAppend = null;
      let edgeKeysChanged = false;
      if (prevOptions !== void 0 && prevOptions.enabled && merged.enabled && merged.anchorTo === "end" && this.scrollElement !== null) {
        const prevCount = prevOptions.count;
        const nextCount = merged.count;
        const measurements = this.getMeasurements();
        const prevFirstKey = prevCount > 0 ? ((_a = measurements[0]) == null ? void 0 : _a.key) ?? prevOptions.getItemKey(0) : null;
        const prevLastKey = prevCount > 0 ? ((_b = measurements[prevCount - 1]) == null ? void 0 : _b.key) ?? prevOptions.getItemKey(prevCount - 1) : null;
        const didCountChange = nextCount !== prevCount;
        const didEdgeKeysChange = didCountChange || prevCount > 0 && nextCount > 0 && (merged.getItemKey(0) !== prevFirstKey || merged.getItemKey(nextCount - 1) !== prevLastKey);
        if (didEdgeKeysChange) {
          edgeKeysChanged = true;
          const item = prevCount > 0 ? this.getVirtualItemForOffset(this.getScrollOffset()) ?? measurements[0] : null;
          if (item) {
            anchor = [item.key, this.getScrollOffset() - item.start];
          }
          const behavior = merged.followOnAppend === true ? "auto" : merged.followOnAppend || null;
          if (behavior && nextCount > prevCount && this.isAtEnd(prevOptions.scrollEndThreshold) && (prevCount === 0 || merged.getItemKey(nextCount - 1) !== prevLastKey)) {
            followOnAppend = behavior;
          }
        }
      }
      this.options = merged;
      if (edgeKeysChanged) {
        this.pendingMin = 0;
        this.itemSizeCacheVersion++;
      }
      let anchorResolved = false;
      let anchorDelta = 0;
      if (anchor && this.scrollOffset !== null) {
        const [anchorKey, anchorOffset] = anchor;
        const newMeasurements = this.getMeasurements();
        const { count, getItemKey } = this.options;
        let idx = 0;
        while (idx < count && getItemKey(idx) !== anchorKey) {
          idx++;
        }
        if (idx < count) {
          const anchorItem = newMeasurements[idx];
          if (anchorItem) {
            const newOffset = Math.max(0, anchorItem.start + anchorOffset);
            if (newOffset !== this.scrollOffset) {
              anchorDelta = newOffset - this.scrollOffset;
              this.scrollOffset = newOffset;
              anchorResolved = true;
            }
          }
        }
      }
      if (anchorResolved || followOnAppend) {
        this.pendingScrollAnchor = [
          anchorResolved ? anchor[0] : null,
          anchorResolved ? anchor[1] : 0,
          followOnAppend,
          anchorDelta
        ];
      }
    };
    this.notify = (sync) => {
      var _a, _b;
      (_b = (_a = this.options).onChange) == null ? void 0 : _b.call(_a, this, sync);
    };
    this.maybeNotify = memo5(
      () => {
        this.calculateRange();
        return [
          this.isScrolling,
          this.range ? this.range.startIndex : null,
          this.range ? this.range.endIndex : null
        ];
      },
      (isScrolling) => {
        this.notify(isScrolling);
      },
      {
        key: "maybeNotify",
        debug: () => this.options.debug,
        initialDeps: [
          this.isScrolling,
          this.range ? this.range.startIndex : null,
          this.range ? this.range.endIndex : null
        ]
      }
    );
    this.cleanup = () => {
      this.unsubs.filter(Boolean).forEach((d) => d());
      this.unsubs = [];
      this.observer.disconnect();
      if (this.rafId != null && this.targetWindow) {
        this.targetWindow.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.scrollState = null;
      this._iosDeferredAdjustment = 0;
      this._iosTouching = false;
      this._iosJustTouchEnded = false;
      this.scrollElement = null;
      this.targetWindow = null;
    };
    this._didMount = () => {
      return () => {
        this.cleanup();
      };
    };
    this._willUpdate = () => {
      var _a;
      const scrollElement = this.options.enabled ? this.options.getScrollElement() : null;
      if (this.scrollElement !== scrollElement) {
        this.cleanup();
        if (!scrollElement) {
          this.maybeNotify();
          return;
        }
        this.scrollElement = scrollElement;
        if (this.scrollElement && "ownerDocument" in this.scrollElement) {
          this.targetWindow = this.scrollElement.ownerDocument.defaultView;
        } else {
          this.targetWindow = ((_a = this.scrollElement) == null ? void 0 : _a.window) ?? null;
        }
        this.elementsCache.forEach((cached) => {
          this.observer.observe(cached);
        });
        this.unsubs.push(
          this.options.observeElementRect(this, (rect) => {
            this.scrollRect = rect;
            this.maybeNotify();
          })
        );
        this.unsubs.push(
          this.options.observeElementOffset(this, (offset, isScrolling) => {
            if (isScrolling && this._intendedScrollOffset === null && offset === this.scrollOffset) {
              return;
            }
            if (this._intendedScrollOffset !== null && Math.abs(offset - this._intendedScrollOffset) < 1.5) {
              offset = this._intendedScrollOffset;
            }
            this._intendedScrollOffset = null;
            this.scrollAdjustments = 0;
            const prevOffset = this.getScrollOffset();
            this.scrollDirection = isScrolling ? prevOffset === offset ? this.scrollDirection : prevOffset < offset ? "forward" : "backward" : null;
            this.scrollOffset = offset;
            this.isScrolling = isScrolling;
            this._flushIosDeferredIfReady();
            if (this.scrollState) {
              this.scheduleScrollReconcile();
            }
            this.maybeNotify();
          })
        );
        if ("addEventListener" in this.scrollElement) {
          const scrollEl = this.scrollElement;
          const onTouchStart = () => {
            this._iosTouching = true;
            this._iosJustTouchEnded = false;
            if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
              this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
              this._iosTouchEndTimerId = null;
            }
          };
          const onTouchEnd = () => {
            this._iosTouching = false;
            if (!isIOSWebKit() || this.targetWindow == null) {
              return;
            }
            this._iosJustTouchEnded = true;
            this._iosTouchEndTimerId = this.targetWindow.setTimeout(() => {
              this._iosJustTouchEnded = false;
              this._iosTouchEndTimerId = null;
              this._flushIosDeferredIfReady();
            }, 150);
          };
          scrollEl.addEventListener(
            "touchstart",
            onTouchStart,
            addEventListenerOptions
          );
          scrollEl.addEventListener(
            "touchend",
            onTouchEnd,
            addEventListenerOptions
          );
          this.unsubs.push(() => {
            scrollEl.removeEventListener("touchstart", onTouchStart);
            scrollEl.removeEventListener("touchend", onTouchEnd);
            if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
              this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
              this._iosTouchEndTimerId = null;
            }
          });
        }
        this._scrollToOffset(this.getScrollOffset(), {
          adjustments: void 0,
          behavior: void 0
        });
      }
      const anchor = this.pendingScrollAnchor;
      this.pendingScrollAnchor = null;
      if (anchor && this.scrollElement && this.options.enabled) {
        const [key19, _offset, followOnAppend, anchorDelta] = anchor;
        if (key19 !== null && !followOnAppend) {
          if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
            if (anchorDelta !== 0) {
              this._iosDeferredAdjustment += anchorDelta;
            }
          } else {
            this._scrollToOffset(this.getScrollOffset(), {
              adjustments: void 0,
              behavior: void 0
            });
          }
        }
        if (followOnAppend) {
          this.scrollToEnd({ behavior: followOnAppend });
        }
      }
    };
    this._flushIosDeferredIfReady = () => {
      if (this._iosDeferredAdjustment === 0) return;
      if (this.isScrolling) return;
      if (this._iosTouching) return;
      if (this._iosJustTouchEnded) return;
      const cur = this.getScrollOffset();
      const max = this.getMaxScrollOffset();
      if (cur < 0 || cur > max) return;
      if (this._iosDeferredAdjustment < 0 && cur >= max - 1) {
        this._iosDeferredAdjustment = 0;
        return;
      }
      const delta = this._iosDeferredAdjustment;
      this._iosDeferredAdjustment = 0;
      this._scrollToOffset(cur, {
        adjustments: this.scrollAdjustments += delta,
        behavior: void 0
      });
    };
    this.rafId = null;
    this.getSize = () => {
      if (!this.options.enabled) {
        this.scrollRect = null;
        return 0;
      }
      this.scrollRect = this.scrollRect ?? this.options.initialRect;
      return this.scrollRect[this.options.horizontal ? "width" : "height"];
    };
    this.getScrollOffset = () => {
      if (!this.options.enabled) {
        this.scrollOffset = null;
        return 0;
      }
      this.scrollOffset = this.scrollOffset ?? (typeof this.options.initialOffset === "function" ? this.options.initialOffset() : this.options.initialOffset);
      return this.scrollOffset;
    };
    this.getMeasurementOptions = memo5(
      () => [
        this.options.count,
        this.options.paddingStart,
        this.options.scrollMargin,
        this.options.getItemKey,
        this.options.enabled,
        this.options.lanes,
        this.options.laneAssignmentMode,
        this.options.gap
      ],
      (count, paddingStart, scrollMargin, getItemKey, enabled, lanes, laneAssignmentMode, gap) => {
        const lanesChanged = this.prevLanes !== void 0 && this.prevLanes !== lanes;
        if (lanesChanged) {
          this.lanesChangedFlag = true;
        }
        this.prevLanes = lanes;
        this.pendingMin = null;
        return {
          count,
          paddingStart,
          scrollMargin,
          getItemKey,
          enabled,
          lanes,
          laneAssignmentMode,
          gap
        };
      },
      {
        key: false
      }
    );
    this.getMeasurements = memo5(
      () => [this.getMeasurementOptions(), this.itemSizeCacheVersion],
      ({
        count,
        paddingStart,
        scrollMargin,
        getItemKey,
        enabled,
        lanes,
        laneAssignmentMode,
        gap
      }, _itemSizeCacheVersion) => {
        const itemSizeCache = this.itemSizeCache;
        if (!enabled) {
          this.measurementsCache = [];
          this.itemSizeCache.clear();
          this.laneAssignments.clear();
          return [];
        }
        if (this.laneAssignments.size > count) {
          for (const index of this.laneAssignments.keys()) {
            if (index >= count) {
              this.laneAssignments.delete(index);
            }
          }
        }
        if (this.lanesChangedFlag) {
          this.lanesChangedFlag = false;
          this.lanesSettling = true;
          this.measurementsCache = [];
          this.itemSizeCache.clear();
          this.laneAssignments.clear();
          this.pendingMin = null;
        }
        if (this.measurementsCache.length === 0 && !this.lanesSettling) {
          this.measurementsCache = this.options.initialMeasurementsCache;
          this.measurementsCache.forEach((item) => {
            this.itemSizeCache.set(item.key, item.size);
          });
        }
        const min = this.lanesSettling ? 0 : this.pendingMin ?? 0;
        this.pendingMin = null;
        if (this.lanesSettling && this.measurementsCache.length === count) {
          this.lanesSettling = false;
        }
        if (lanes === 1) {
          const need = count * 2;
          let flat = this._flatMeasurements;
          if (!flat || flat.length < need) {
            const next = new Float64Array(need);
            if (flat && min > 0) next.set(flat.subarray(0, min * 2));
            flat = next;
            this._flatMeasurements = flat;
          }
          let runningStart;
          if (min === 0) {
            runningStart = paddingStart + scrollMargin;
          } else {
            const prevIdx = min - 1;
            runningStart = flat[prevIdx * 2] + flat[prevIdx * 2 + 1] + gap;
          }
          for (let i = min; i < count; i++) {
            const key19 = getItemKey(i);
            const measuredSize = itemSizeCache.get(key19);
            const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
            flat[i * 2] = runningStart;
            flat[i * 2 + 1] = size;
            runningStart += size + gap;
          }
          const view = createLazyMeasurementsView(count, flat, getItemKey);
          this.measurementsCache = view;
          return view;
        }
        const measurements = this.measurementsCache.slice(0, min);
        const laneLastIndex = new Array(lanes).fill(
          void 0
        );
        const laneEnds = new Float64Array(lanes);
        let filledLanes = 0;
        for (let m = 0; m < min; m++) {
          const item = measurements[m];
          if (item) {
            if (laneLastIndex[item.lane] === void 0) filledLanes++;
            laneLastIndex[item.lane] = m;
            laneEnds[item.lane] = item.end;
          }
        }
        for (let i = min; i < count; i++) {
          const key19 = getItemKey(i);
          const cachedLane = this.laneAssignments.get(i);
          let lane;
          let start;
          const shouldCacheLane = laneAssignmentMode === "estimate" || itemSizeCache.has(key19);
          if (cachedLane !== void 0 && this.options.lanes > 1) {
            lane = cachedLane;
            const prevIndex = laneLastIndex[lane];
            const prevInLane = prevIndex !== void 0 ? measurements[prevIndex] : void 0;
            start = prevInLane ? prevInLane.end + gap : paddingStart + scrollMargin;
          } else if (filledLanes === lanes) {
            let bestLane = 0;
            let bestEnd = laneEnds[0];
            let bestIdx = laneLastIndex[0];
            for (let l = 1; l < lanes; l++) {
              const e = laneEnds[l];
              if (e < bestEnd || e === bestEnd && laneLastIndex[l] < bestIdx) {
                bestLane = l;
                bestEnd = e;
                bestIdx = laneLastIndex[l];
              }
            }
            lane = bestLane;
            start = bestEnd + gap;
            if (shouldCacheLane) {
              this.laneAssignments.set(i, lane);
            }
          } else {
            lane = i % this.options.lanes;
            start = paddingStart + scrollMargin;
            if (shouldCacheLane) {
              this.laneAssignments.set(i, lane);
            }
          }
          const measuredSize = itemSizeCache.get(key19);
          const size = typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
          const end = start + size;
          measurements[i] = {
            index: i,
            start,
            size,
            end,
            key: key19,
            lane
          };
          if (laneLastIndex[lane] === void 0) filledLanes++;
          laneLastIndex[lane] = i;
          laneEnds[lane] = end;
        }
        this.measurementsCache = measurements;
        return measurements;
      },
      {
        key: "getMeasurements",
        debug: () => this.options.debug
      }
    );
    this.calculateRange = memo5(
      () => [
        this.getMeasurements(),
        this.getSize(),
        this.getScrollOffset(),
        this.options.lanes
      ],
      (measurements, outerSize, scrollOffset, lanes) => {
        if (measurements.length === 0 || outerSize === 0) {
          this.range = null;
          return null;
        }
        this.range = calculateRangeImpl(
          measurements,
          outerSize,
          scrollOffset,
          lanes,
          // Pass the typed array so binary search + forward-walk can read
          // start/end directly from Float64Array, skipping the Proxy traps.
          lanes === 1 && this._flatMeasurements != null ? this._flatMeasurements : null
        );
        return this.range;
      },
      {
        key: "calculateRange",
        debug: () => this.options.debug
      }
    );
    this.getVirtualIndexes = memo5(
      () => {
        let startIndex = null;
        let endIndex = null;
        const range = this.calculateRange();
        if (range) {
          startIndex = range.startIndex;
          endIndex = range.endIndex;
        }
        this.maybeNotify.updateDeps([this.isScrolling, startIndex, endIndex]);
        return [
          this.options.rangeExtractor,
          this.options.overscan,
          this.options.count,
          startIndex,
          endIndex
        ];
      },
      (rangeExtractor, overscan, count, startIndex, endIndex) => {
        return startIndex === null || endIndex === null ? [] : rangeExtractor({
          startIndex,
          endIndex,
          overscan,
          count
        });
      },
      {
        key: "getVirtualIndexes",
        debug: () => this.options.debug
      }
    );
    this.indexFromElement = (node) => {
      const attributeName = this.options.indexAttribute;
      const indexStr = node.getAttribute(attributeName);
      if (!indexStr) {
        console.warn(
          `Missing attribute name '${attributeName}={index}' on measured element.`
        );
        return -1;
      }
      return parseInt(indexStr, 10);
    };
    this.shouldMeasureDuringScroll = (index) => {
      var _a;
      if (!this.scrollState || this.scrollState.behavior !== "smooth") {
        return true;
      }
      const scrollIndex = this.scrollState.index ?? ((_a = this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)) == null ? void 0 : _a.index);
      if (scrollIndex !== void 0 && this.range) {
        const bufferSize = Math.max(
          this.options.overscan,
          Math.ceil((this.range.endIndex - this.range.startIndex) / 2)
        );
        const minIndex = Math.max(0, scrollIndex - bufferSize);
        const maxIndex = Math.min(
          this.options.count - 1,
          scrollIndex + bufferSize
        );
        return index >= minIndex && index <= maxIndex;
      }
      return true;
    };
    this.measureElement = (node) => {
      if (!node) {
        this.elementsCache.forEach((cached, key22) => {
          if (!cached.isConnected) {
            this.observer.unobserve(cached);
            this.elementsCache.delete(key22);
          }
        });
        return;
      }
      const index = this.indexFromElement(node);
      const key19 = this.options.getItemKey(index);
      const prevNode = this.elementsCache.get(key19);
      if (prevNode !== node) {
        if (prevNode) {
          this.observer.unobserve(prevNode);
        }
        this.observer.observe(node);
        this.elementsCache.set(key19, node);
      }
      if ((!this.isScrolling || this.scrollState) && this.shouldMeasureDuringScroll(index)) {
        this.resizeItem(index, this.options.measureElement(node, void 0, this));
      }
    };
    this.resizeItem = (index, size) => {
      var _a, _b;
      if (index < 0 || index >= this.options.count) return;
      let cachedSize;
      let itemStart;
      let key19;
      const flat = this._flatMeasurements;
      if (this.options.lanes === 1 && flat !== null) {
        key19 = this.options.getItemKey(index);
        itemStart = flat[index * 2];
        cachedSize = flat[index * 2 + 1];
      } else {
        const item = this.measurementsCache[index];
        if (!item) return;
        key19 = item.key;
        itemStart = item.start;
        cachedSize = item.size;
      }
      const itemSize = this.itemSizeCache.get(key19) ?? cachedSize;
      const delta = size - itemSize;
      if (delta !== 0) {
        const wasAtEnd = this.options.anchorTo === "end" && ((_a = this.scrollState) == null ? void 0 : _a.behavior) !== "smooth" && this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold;
        const prevTotalSize = wasAtEnd ? this.getTotalSize() : 0;
        const scrollOffsetWithAdj = this.getScrollOffset() + this.scrollAdjustments;
        const isFirstMeasure = !this.itemSizeCache.has(key19);
        const defaultShouldAdjust = isFirstMeasure ? (
          // First measurement: compensate any item whose top sits above the
          // fold — the estimate→actual delta must be corrected regardless of
          // scroll direction, since the whole estimated block was above it.
          itemStart < scrollOffsetWithAdj
        ) : (
          // Re-measurement: only compensate an item that is ENTIRELY above the
          // fold. An item that merely *spans* the fold (top above, bottom
          // below — e.g. a streaming chat message growing at its bottom)
          // changes size *below* the anchor point, so shifting scrollTop by the
          // delta would drag the viewport downward on every growth (#1218).
          // Also skip during backward scroll to avoid the "items jump while
          // scrolling up" cascade.
          itemStart + itemSize <= scrollOffsetWithAdj && this.scrollDirection !== "backward"
        );
        const shouldAdjustScroll = ((_b = this.scrollState) == null ? void 0 : _b.behavior) !== "smooth" && (this.shouldAdjustScrollPositionOnItemSizeChange !== void 0 ? this.shouldAdjustScrollPositionOnItemSizeChange(
          // The callback expects a VirtualItem; build one lazily only
          // when the consumer actually supplied a custom predicate.
          this.measurementsCache[index] ?? {
            index,
            key: key19,
            start: itemStart,
            size: cachedSize,
            end: itemStart + cachedSize,
            lane: 0
          },
          delta,
          this
        ) : defaultShouldAdjust);
        if (this.pendingMin === null || index < this.pendingMin) {
          this.pendingMin = index;
        }
        this.itemSizeCache.set(key19, size);
        this.itemSizeCacheVersion++;
        let adjustedSync = false;
        if (wasAtEnd) {
          adjustedSync = this.applyScrollAdjustment(
            this.getTotalSize() - prevTotalSize
          );
        } else if (shouldAdjustScroll) {
          adjustedSync = this.applyScrollAdjustment(delta);
        }
        this.notify(adjustedSync);
      }
    };
    this.getVirtualItems = memo5(
      () => [this.getVirtualIndexes(), this.getMeasurements()],
      (indexes, measurements) => {
        const virtualItems = [];
        for (let k = 0, len = indexes.length; k < len; k++) {
          const i = indexes[k];
          const measurement = measurements[i];
          virtualItems.push(measurement);
        }
        return virtualItems;
      },
      {
        key: "getVirtualItems",
        debug: () => this.options.debug
      }
    );
    this.getVirtualItemForOffset = (offset) => {
      const measurements = this.getMeasurements();
      if (measurements.length === 0) {
        return void 0;
      }
      const flat = this._flatMeasurements;
      const useFlat = this.options.lanes === 1 && flat != null;
      const idx = findNearestBinarySearch(
        0,
        measurements.length - 1,
        useFlat ? (i) => flat[i * 2] : (i) => notUndefined(measurements[i]).start,
        offset
      );
      return notUndefined(measurements[idx]);
    };
    this.getMaxScrollOffset = () => {
      if (!this.scrollElement) return 0;
      if ("scrollHeight" in this.scrollElement) {
        return this.options.horizontal ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth : this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
      } else {
        const doc = this.scrollElement.document.documentElement;
        return this.options.horizontal ? doc.scrollWidth - this.scrollElement.innerWidth : doc.scrollHeight - this.scrollElement.innerHeight;
      }
    };
    this.getVirtualDistanceFromEnd = () => {
      return Math.max(
        this.getTotalSize() - this.getSize() - this.getScrollOffset(),
        0
      );
    };
    this.getDistanceFromEnd = () => {
      return Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0);
    };
    this.isAtEnd = (threshold = this.options.scrollEndThreshold) => {
      return this.getDistanceFromEnd() <= threshold;
    };
    this.getOffsetForAlignment = (toOffset, align, itemSize = 0) => {
      if (!this.scrollElement) return 0;
      const size = this.getSize();
      const scrollOffset = this.getScrollOffset();
      if (align === "auto") {
        align = toOffset >= scrollOffset + size ? "end" : "start";
      }
      if (align === "center") {
        toOffset += (itemSize - size) / 2;
      } else if (align === "end") {
        toOffset -= size;
      }
      const maxOffset = this.getMaxScrollOffset();
      return Math.max(Math.min(maxOffset, toOffset), 0);
    };
    this.getOffsetForIndex = (index, align = "auto") => {
      index = Math.max(0, Math.min(index, this.options.count - 1));
      const size = this.getSize();
      const scrollOffset = this.getScrollOffset();
      const item = this.measurementsCache[index];
      if (!item) return;
      if (align === "auto") {
        if (item.end >= scrollOffset + size - this.options.scrollPaddingEnd) {
          align = "end";
        } else if (item.start <= scrollOffset + this.options.scrollPaddingStart) {
          align = "start";
        } else {
          return [scrollOffset, align];
        }
      }
      if (align === "end" && index === this.options.count - 1) {
        return [this.getMaxScrollOffset(), align];
      }
      const toOffset = align === "end" ? item.end + this.options.scrollPaddingEnd : item.start - this.options.scrollPaddingStart;
      return [
        this.getOffsetForAlignment(toOffset, align, item.size),
        align
      ];
    };
    this.scrollToOffset = (toOffset, { align = "start", behavior = "auto" } = {}) => {
      this._iosDeferredAdjustment = 0;
      const offset = this.getOffsetForAlignment(toOffset, align);
      const now = this.now();
      this.scrollState = {
        index: null,
        align,
        behavior,
        startedAt: now,
        lastTargetOffset: offset,
        stableFrames: 0
      };
      this._scrollToOffset(offset, { adjustments: void 0, behavior });
      this.scheduleScrollReconcile();
    };
    this.scrollToIndex = (index, {
      align: initialAlign = "auto",
      behavior = "auto"
    } = {}) => {
      this._iosDeferredAdjustment = 0;
      index = Math.max(0, Math.min(index, this.options.count - 1));
      const offsetInfo = this.getOffsetForIndex(index, initialAlign);
      if (!offsetInfo) {
        return;
      }
      const [offset, align] = offsetInfo;
      const now = this.now();
      this.scrollState = {
        index,
        align,
        behavior,
        startedAt: now,
        lastTargetOffset: offset,
        stableFrames: 0
      };
      this._scrollToOffset(offset, { adjustments: void 0, behavior });
      this.scheduleScrollReconcile();
    };
    this.scrollBy = (delta, { behavior = "auto" } = {}) => {
      const offset = this.getScrollOffset() + delta;
      const now = this.now();
      this.scrollState = {
        index: null,
        align: "start",
        behavior,
        startedAt: now,
        lastTargetOffset: offset,
        stableFrames: 0
      };
      this._scrollToOffset(offset, { adjustments: void 0, behavior });
      this.scheduleScrollReconcile();
    };
    this.scrollToEnd = ({ behavior = "auto" } = {}) => {
      if (this.options.count > 0) {
        this.scrollToIndex(this.options.count - 1, {
          align: "end",
          behavior
        });
        return;
      }
      this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), {
        behavior
      });
    };
    this.getTotalSize = () => {
      var _a;
      const measurements = this.getMeasurements();
      let end;
      if (measurements.length === 0) {
        end = this.options.paddingStart;
      } else if (this.options.lanes === 1) {
        const lastIdx = measurements.length - 1;
        const flat = this._flatMeasurements;
        if (flat != null) {
          end = flat[lastIdx * 2] + flat[lastIdx * 2 + 1];
        } else {
          end = ((_a = measurements[lastIdx]) == null ? void 0 : _a.end) ?? 0;
        }
      } else {
        const endByLane = Array(this.options.lanes).fill(null);
        let endIndex = measurements.length - 1;
        while (endIndex >= 0 && endByLane.some((val) => val === null)) {
          const item = measurements[endIndex];
          if (endByLane[item.lane] === null) {
            endByLane[item.lane] = item.end;
          }
          endIndex--;
        }
        end = Math.max(...endByLane.filter((val) => val !== null));
      }
      return Math.max(
        end - this.options.scrollMargin + this.options.paddingEnd,
        0
      );
    };
    this.takeSnapshot = () => {
      const snapshot2 = [];
      if (this.itemSizeCache.size === 0) return snapshot2;
      const m = this.getMeasurements();
      for (const item of m) {
        if (item && this.itemSizeCache.has(item.key)) {
          snapshot2.push({
            index: item.index,
            key: item.key,
            start: item.start,
            size: item.size,
            end: item.end,
            lane: item.lane
          });
        }
      }
      return snapshot2;
    };
    this._scrollToOffset = (offset, {
      adjustments,
      behavior
    }) => {
      this._intendedScrollOffset = offset + (adjustments ?? 0);
      this.options.scrollToFn(offset, { behavior, adjustments }, this);
    };
    this.measure = () => {
      this.pendingMin = null;
      this.itemSizeCache.clear();
      this.laneAssignments.clear();
      this.itemSizeCacheVersion++;
      this.notify(false);
    };
    this.setOptions(opts);
  }
  // Returns `true` when it performed a synchronous `scrollTop` write this
  // tick, `false` when the delta was zero or the write was deferred (iOS).
  // `resizeItem` uses that to decide whether the follow-up `notify` must be
  // synchronous so the grown transforms commit in the same paint (#1227).
  applyScrollAdjustment(delta, behavior) {
    if (delta === 0) return false;
    if (this.options.debug) {
      console.info("correction", delta);
    }
    if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
      this._iosDeferredAdjustment += delta;
      return false;
    } else {
      this._scrollToOffset(this.getScrollOffset(), {
        adjustments: this.scrollAdjustments += delta,
        behavior
      });
      if (this.scrollOffset !== null) {
        this.scrollOffset += this.scrollAdjustments;
        if (this.scrollOffset < 0) this.scrollOffset = 0;
        this.scrollAdjustments = 0;
      }
      return true;
    }
  }
  scheduleScrollReconcile() {
    if (!this.targetWindow) {
      this.scrollState = null;
      return;
    }
    if (this.rafId != null) return;
    this.rafId = this.targetWindow.requestAnimationFrame(() => {
      this.rafId = null;
      this.reconcileScroll();
    });
  }
  reconcileScroll() {
    if (!this.scrollState) return;
    const el = this.scrollElement;
    if (!el) return;
    const MAX_RECONCILE_MS = 5e3;
    if (this.now() - this.scrollState.startedAt > MAX_RECONCILE_MS) {
      this.scrollState = null;
      return;
    }
    const offsetInfo = this.scrollState.index != null ? this.getOffsetForIndex(this.scrollState.index, this.scrollState.align) : void 0;
    const targetOffset = offsetInfo ? offsetInfo[0] : this.scrollState.lastTargetOffset;
    const STABLE_FRAMES = 1;
    const targetChanged = targetOffset !== this.scrollState.lastTargetOffset;
    if (!targetChanged && approxEqual(targetOffset, this.getScrollOffset())) {
      this.scrollState.stableFrames++;
      if (this.scrollState.stableFrames >= STABLE_FRAMES) {
        if (this.getScrollOffset() !== targetOffset) {
          this._scrollToOffset(targetOffset, {
            adjustments: void 0,
            behavior: "auto"
          });
        }
        this.scrollState = null;
        return;
      }
    } else {
      this.scrollState.stableFrames = 0;
      if (targetChanged) {
        const viewport = this.getSize() || 600;
        const distance = Math.abs(targetOffset - this.getScrollOffset());
        const keepSmooth = this.scrollState.behavior === "smooth" && distance > viewport;
        this.scrollState.lastTargetOffset = targetOffset;
        if (!keepSmooth) {
          this.scrollState.behavior = "auto";
        }
        this._scrollToOffset(targetOffset, {
          adjustments: void 0,
          behavior: keepSmooth ? "smooth" : "auto"
        });
      }
    }
    this.scheduleScrollReconcile();
  }
};
var findNearestBinarySearch = (low, high, getCurrentValue, value) => {
  while (low <= high) {
    const middle = (low + high) / 2 | 0;
    const currentValue = getCurrentValue(middle);
    if (currentValue < value) {
      low = middle + 1;
    } else if (currentValue > value) {
      high = middle - 1;
    } else {
      return middle;
    }
  }
  if (low > 0) {
    return low - 1;
  } else {
    return 0;
  }
};
function findNearestBinarySearchFlat(flat, high, value) {
  let low = 0;
  while (low <= high) {
    const middle = (low + high) / 2 | 0;
    const currentValue = flat[middle * 2];
    if (currentValue < value) {
      low = middle + 1;
    } else if (currentValue > value) {
      high = middle - 1;
    } else {
      return middle;
    }
  }
  return low > 0 ? low - 1 : 0;
}
function calculateRangeImpl(measurements, outerSize, scrollOffset, lanes, flat) {
  const lastIndex = measurements.length - 1;
  if (measurements.length <= lanes) {
    return { startIndex: 0, endIndex: lastIndex };
  }
  if (lanes === 1 && flat !== null) {
    const startIndex2 = findNearestBinarySearchFlat(
      flat,
      lastIndex,
      scrollOffset
    );
    let endIndex2 = startIndex2;
    const limit = scrollOffset + outerSize;
    while (endIndex2 < lastIndex && flat[endIndex2 * 2] + flat[endIndex2 * 2 + 1] < limit) {
      endIndex2++;
    }
    return { startIndex: startIndex2, endIndex: endIndex2 };
  }
  const getStart = (index) => measurements[index].start;
  let startIndex = findNearestBinarySearch(0, lastIndex, getStart, scrollOffset);
  let endIndex = startIndex;
  if (lanes === 1) {
    while (endIndex < lastIndex && measurements[endIndex].end < scrollOffset + outerSize) {
      endIndex++;
    }
  } else if (lanes > 1) {
    const endPerLane = Array(lanes).fill(0);
    while (endIndex < lastIndex && endPerLane.some((pos) => pos < scrollOffset + outerSize)) {
      const item = measurements[endIndex];
      endPerLane[item.lane] = item.end;
      endIndex++;
    }
    const startPerLane = Array(lanes).fill(scrollOffset + outerSize);
    while (startIndex >= 0 && startPerLane.some((pos) => pos >= scrollOffset)) {
      const item = measurements[startIndex];
      startPerLane[item.lane] = item.start;
      startIndex--;
    }
    startIndex = Math.max(0, startIndex - startIndex % lanes);
    endIndex = Math.min(lastIndex, endIndex + (lanes - 1 - endIndex % lanes));
  }
  return { startIndex, endIndex };
}

// ../../../../build-tools/node_modules/@tanstack/react-virtual/dist/esm/index.js
var useIsomorphicLayoutEffect = typeof document !== "undefined" ? React.useLayoutEffect : React.useEffect;
function useVirtualizerBase({
  useFlushSync = true,
  directDomUpdates = false,
  directDomUpdatesMode = "transform",
  ...options
}) {
  const rerender = React.useReducer((x) => x + 1, 0)[1];
  const directRef = React.useRef({
    enabled: directDomUpdates,
    mode: directDomUpdatesMode,
    container: null,
    lastSize: null,
    // Keyed by the element itself so a remounted node (same key, new DOM
    // node — e.g. when `enabled` is toggled off then on) is treated as fresh
    // and gets its style written.
    lastPositions: /* @__PURE__ */ new WeakMap(),
    prevRange: null
  });
  directRef.current.enabled = directDomUpdates;
  directRef.current.mode = directDomUpdatesMode;
  const applyContainerSize = (instance2) => {
    const state = directRef.current;
    if (!state.enabled || !state.container) return;
    const totalSize = instance2.getTotalSize();
    if (totalSize !== state.lastSize) {
      state.lastSize = totalSize;
      const sizeAxis = instance2.options.horizontal ? "width" : "height";
      state.container.style[sizeAxis] = `${totalSize}px`;
    }
  };
  const applyDirectStyles = (instance2) => {
    const state = directRef.current;
    if (!state.enabled || !state.container) return;
    applyContainerSize(instance2);
    const horizontal = !!instance2.options.horizontal;
    const useTransform = state.mode === "transform";
    const posAxis = horizontal ? "left" : "top";
    const scrollMargin = instance2.options.scrollMargin;
    const items = instance2.getVirtualItems();
    for (const item of items) {
      const next = item.start - scrollMargin;
      const el = instance2.elementsCache.get(item.key);
      if (!el) continue;
      if (state.lastPositions.get(el) === next) continue;
      state.lastPositions.set(el, next);
      if (useTransform) {
        el.style.transform = horizontal ? `translate3d(${next}px, 0, 0)` : `translate3d(0, ${next}px, 0)`;
      } else {
        el.style[posAxis] = `${next}px`;
      }
    }
  };
  const resolvedOptions = {
    ...options,
    onChange: (instance2, sync) => {
      var _a;
      const state = directRef.current;
      let shouldRerender = true;
      if (state.enabled) {
        applyDirectStyles(instance2);
        const range = instance2.range;
        const prev = state.prevRange;
        shouldRerender = !prev || prev.isScrolling !== instance2.isScrolling || prev.startIndex !== (range == null ? void 0 : range.startIndex) || prev.endIndex !== (range == null ? void 0 : range.endIndex);
        if (shouldRerender) {
          state.prevRange = range ? {
            startIndex: range.startIndex,
            endIndex: range.endIndex,
            isScrolling: instance2.isScrolling
          } : null;
        }
      }
      if (shouldRerender) {
        if (useFlushSync && sync) {
          (0, import_react_dom.flushSync)(rerender);
        } else {
          rerender();
        }
      }
      (_a = options.onChange) == null ? void 0 : _a.call(options, instance2, sync);
    }
  };
  const [instance] = React.useState(() => {
    const v = new Virtualizer(resolvedOptions);
    return Object.assign(v, {
      containerRef: (node) => {
        const state = directRef.current;
        state.container = node;
        state.lastSize = null;
        if (node && state.enabled) {
          const total = v.getTotalSize();
          state.lastSize = total;
          const axis = v.options.horizontal ? "width" : "height";
          node.style[axis] = `${total}px`;
        }
      }
    });
  });
  instance.setOptions(resolvedOptions);
  useIsomorphicLayoutEffect(() => {
    return instance._didMount();
  }, []);
  useIsomorphicLayoutEffect(() => {
    applyContainerSize(instance);
    return instance._willUpdate();
  });
  useIsomorphicLayoutEffect(() => {
    applyDirectStyles(instance);
  });
  return instance;
}
function useVirtualizer(options) {
  return useVirtualizerBase({
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    ...options
  });
}

// chat/TurnNavigator.module.css
var owner7 = "dsh-nexttavern-ui-chat";
var key7 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/TurnNavigator.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key7)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner7;
  style.dataset.pluginCss = key7;
  style.textContent = '.zpbvXq_slot{z-index:7;pointer-events:none;height:0;position:sticky;top:0}.zpbvXq_frame{--turn-rail-band:calc(var(--dsh-conversation-viewport-height,100dvh) - var(--dsh-composer-height,152px));--turn-preview-height:100px;top:calc(var(--turn-rail-band) / 2);right:calc(12px - (var(--dsh-composer-side-clearance) + 16px));width:28px;max-height:min(max(0px, calc(var(--turn-rail-band) - 64px)), 420px);contain:layout;cursor:pointer;pointer-events:auto;position:absolute;transform:translateY(-50%)}.zpbvXq_scroller{max-height:inherit;overscroll-behavior:contain;scrollbar-width:none;position:relative;overflow-y:auto}.zpbvXq_scroller::-webkit-scrollbar{display:none}.zpbvXq_fadeTop{mask-image:linear-gradient(#0000 0,#000 24px 100%)}.zpbvXq_fadeBottom{mask-image:linear-gradient(#000 0 calc(100% - 24px),#0000 100%)}.zpbvXq_fadeTop.zpbvXq_fadeBottom{mask-image:linear-gradient(#0000 0,#000 24px calc(100% - 24px),#0000 100%)}.zpbvXq_marks{position:relative}.zpbvXq_mark{cursor:pointer;background:0 0;border:0;border-radius:8px;height:10px;padding:0;position:absolute;top:0;left:0;right:0}.zpbvXq_mark:before{background:var(--dsw-alias-border-l4);content:"";transform-origin:100%;border-radius:2px;width:20px;height:2px;transition:transform .14s,background-color .14s;position:absolute;top:50%;right:0;transform:translateY(-50%)scaleX(.6)}.zpbvXq_markUnloaded:before{opacity:.6;transform:translateY(-50%)scaleX(.4)}.zpbvXq_markPreview:before{background:var(--dsw-alias-label-tertiary);transform:translateY(-50%)scaleX(.9)}.zpbvXq_markBusy:before{animation:1s ease-in-out infinite zpbvXq_dsh-turn-mark-busy}.zpbvXq_markActive:before{background:var(--dsw-alias-label-primary);transform:translateY(-50%)scaleX(1)}.zpbvXq_mark:focus-visible:before{background:var(--dsw-alias-state-business-primary);transform:translateY(-50%)scaleX(1)}.zpbvXq_mark:focus-visible{outline:none}.zpbvXq_mark:focus-visible:after{border-radius:inherit;outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:2px;content:"";width:20px;position:absolute;inset:0 0 0 auto}.zpbvXq_preview{top:clamp(0px, calc(var(--turn-preview-center) - var(--turn-preview-height) / 2), calc(100% - var(--turn-preview-height)));box-sizing:border-box;width:min(300px,100cqw - 120px);max-height:var(--turn-preview-height);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-panel);pointer-events:none;border:0;border-radius:10px;padding:10px 12px;transition:top .14s cubic-bezier(.2,.8,.2,1);animation:.12s ease-out zpbvXq_dsh-turn-preview-enter;position:absolute;right:calc(100% + 10px);overflow:hidden}.zpbvXq_previewPrompt,.zpbvXq_previewResponse{-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.zpbvXq_previewPrompt{font:var(--dsw-font-xs-strong-13);-webkit-line-clamp:1}.zpbvXq_previewResponse{color:var(--dsw-alias-label-caption);font:var(--dsw-font-xxs-12);-webkit-line-clamp:3;margin-top:4px}@keyframes zpbvXq_dsh-turn-preview-enter{0%{opacity:0;transform:translate(4px)}to{opacity:1;transform:translate(0)}}@keyframes zpbvXq_dsh-turn-mark-busy{0%,to{opacity:1}50%{opacity:.35}}@container (width<=900px){.zpbvXq_slot{display:none}}@media (prefers-reduced-motion:reduce){.zpbvXq_frame,.zpbvXq_scroller,.zpbvXq_mark:before,.zpbvXq_markBusy:before,.zpbvXq_preview{scroll-behavior:auto;transition:none;animation:none}}';
  document.head.appendChild(style);
}
var TurnNavigator_default = { "dsh-turn-mark-busy": "zpbvXq_dsh-turn-mark-busy", "dsh-turn-preview-enter": "zpbvXq_dsh-turn-preview-enter", "fadeBottom": "zpbvXq_fadeBottom", "fadeTop": "zpbvXq_fadeTop", "frame": "zpbvXq_frame", "mark": "zpbvXq_mark", "markActive": "zpbvXq_markActive", "markBusy": "zpbvXq_markBusy", "markPreview": "zpbvXq_markPreview", "marks": "zpbvXq_marks", "markUnloaded": "zpbvXq_markUnloaded", "preview": "zpbvXq_preview", "previewPrompt": "zpbvXq_previewPrompt", "previewResponse": "zpbvXq_previewResponse", "scroller": "zpbvXq_scroller", "slot": "zpbvXq_slot" };

// chat/TurnNavigator.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var TURN_SPACING_PX = 10;
var RAIL_INSET_PX = 6;
var FADE_PX = 24;
function preferredScrollBehavior() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
var TurnMark = (0, import_react11.memo)(function TurnMark2({
  item,
  index,
  active,
  busy,
  previewId,
  registerElement,
  onNavigate,
  onPreview,
  onFocusChange,
  t
}) {
  const classes = [TurnNavigator_default.mark];
  if (item.anchor.kind === "unloaded") classes.push(TurnNavigator_default.markUnloaded);
  if (active) classes.push(TurnNavigator_default.markActive);
  else if (previewId !== void 0) classes.push(TurnNavigator_default.markPreview);
  if (busy) classes.push(TurnNavigator_default.markBusy);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "button",
    {
      ref: registerElement,
      "data-index": index,
      type: "button",
      className: classes.join(" "),
      "aria-label": t(
        item.anchor.kind === "loaded" ? "chat.turnNavigation.jump" : "chat.turnNavigation.jumpLoad",
        { turn: item.turn }
      ),
      "aria-current": active ? "true" : void 0,
      "aria-busy": busy ? "true" : void 0,
      "aria-describedby": previewId,
      onPointerMove: () => {
        onPreview(item.turn);
      },
      onClick: () => {
        onNavigate(item);
      },
      onFocus: () => {
        onFocusChange(item.turn);
      },
      onBlur: () => {
        onFocusChange(null);
      }
    }
  );
});
function TurnNavigatorRail({ items, activeTurn, busyTurn, onNavigate, t }, ref) {
  const [previewTurn, setPreviewTurn] = (0, import_react11.useState)(null);
  const [focusedTurn, setFocusedTurn] = (0, import_react11.useState)(null);
  const scrollerRef = (0, import_react11.useRef)(null);
  const initialization = (0, import_react11.useRef)({
    placed: false,
    index: 0,
    follow: null,
    publishOffset: null
  });
  const pointerInsideRef = (0, import_react11.useRef)(false);
  const previewId = (0, import_react11.useId)();
  const turnIndexes = (0, import_react11.useMemo)(() => {
    const indexes = /* @__PURE__ */ new Map();
    items.forEach((item, index) => {
      indexes.set(item.turn, index);
    });
    return indexes;
  }, [items]);
  const activeIndex = activeTurn === null ? void 0 : turnIndexes.get(activeTurn);
  (0, import_react11.useLayoutEffect)(() => {
    initialization.current.index = activeIndex ?? 0;
  }, [activeIndex]);
  const focusedIndex = focusedTurn === null ? void 0 : turnIndexes.get(focusedTurn);
  const previewIndex = previewTurn === null ? void 0 : turnIndexes.get(previewTurn);
  const onFocusChange = (0, import_react11.useCallback)((turn) => {
    setFocusedTurn(turn);
    setPreviewTurn(turn);
  }, []);
  const virtualizer = useVirtualizer({
    count: items.length,
    enabled: items.length >= 2,
    directDomUpdates: true,
    directDomUpdatesMode: "transform",
    useScrollendEvent: true,
    getScrollElement: (0, import_react11.useCallback)(() => scrollerRef.current, []),
    getItemKey: (0, import_react11.useCallback)((index) => items[index]?.turn ?? index, [items]),
    estimateSize: () => TURN_SPACING_PX,
    measureElement: () => TURN_SPACING_PX,
    initialRect: { width: 0, height: 0 },
    initialOffset: 0,
    scrollToFn: (offset, options, instance) => {
      if (initialization.current.placed) elementScroll(offset, options, instance);
    },
    observeElementOffset: (instance, notify) => {
      initialization.current.publishOffset = notify;
      const dispose = observeElementOffset(instance, notify);
      return () => {
        dispose?.();
        initialization.current.placed = false;
        initialization.current.follow = null;
        initialization.current.publishOffset = null;
      };
    },
    observeElementRect: (instance, notify) => {
      const element = instance.scrollElement;
      const Observer = instance.targetWindow?.ResizeObserver;
      if (element === null || Observer === void 0) return;
      const observer = new Observer(([entry]) => {
        if (entry === void 0) return;
        const box = entry.borderBoxSize[0];
        const rect = {
          width: Math.round(box?.inlineSize ?? entry.contentRect.width),
          height: Math.round(box?.blockSize ?? entry.contentRect.height)
        };
        const initial = initialization.current;
        if (!initial.placed && rect.height > 0) {
          const max = Math.max(0, instance.getTotalSize() - rect.height);
          const center = initial.index * TURN_SPACING_PX + RAIL_INSET_PX;
          const target = Math.max(0, Math.min(max, center - rect.height / 2));
          initial.placed = true;
          initial.follow = { index: initial.index, count: instance.options.count, height: rect.height };
          element.scrollTop = target;
          initial.publishOffset?.(target, false);
        }
        notify(rect);
      });
      observer.observe(element, { box: "border-box" });
      return () => {
        observer.disconnect();
      };
    },
    paddingStart: RAIL_INSET_PX - TURN_SPACING_PX / 2,
    paddingEnd: RAIL_INSET_PX - TURN_SPACING_PX / 2,
    scrollPaddingStart: FADE_PX,
    scrollPaddingEnd: FADE_PX,
    overscan: 3,
    rangeExtractor: (0, import_react11.useCallback)((range) => {
      const indexes = defaultRangeExtractor(range);
      if (focusedIndex !== void 0) {
        const last = Math.min(range.count - 1, focusedIndex + 1);
        for (let index = Math.max(0, focusedIndex - 1); index <= last; index++) {
          if (!indexes.includes(index)) indexes.push(index);
        }
        indexes.sort((left, right) => left - right);
      }
      return indexes;
    }, [focusedIndex])
  });
  const scrollTop = virtualizer.scrollOffset ?? 0;
  const viewHeight = virtualizer.scrollRect?.height ?? 0;
  const virtualItems = virtualizer.getVirtualItems();
  const scrollToIndex = (0, import_react11.useCallback)((index, reveal, behavior = preferredScrollBehavior()) => {
    const item = virtualizer.measurementsCache[index];
    const height = virtualizer.scrollRect?.height ?? 0;
    if (item === void 0 || height <= 0) return;
    const current = virtualizer.scrollOffset ?? 0;
    const center = item.start + item.size / 2;
    if (reveal === "if-needed") {
      const { scrollPaddingStart, scrollPaddingEnd } = virtualizer.options;
      if (center >= current + scrollPaddingStart && center <= current + height - scrollPaddingEnd) return;
    }
    const target = center - height / 2;
    const max = Math.max(0, virtualizer.getTotalSize() - height);
    const delta = Math.max(0, Math.min(max, target)) - current;
    if (delta !== 0) virtualizer.scrollBy(delta, { behavior });
  }, [virtualizer]);
  (0, import_react11.useImperativeHandle)(ref, () => ({
    activateTurn(turn) {
      const index = turnIndexes.get(turn);
      const item = index === void 0 ? void 0 : items[index];
      if (item !== void 0) onNavigate(item);
    },
    scrollToTurn(turn) {
      const index = turnIndexes.get(turn);
      if (index !== void 0) scrollToIndex(index, "always");
    }
  }), [items, turnIndexes, onNavigate, scrollToIndex]);
  (0, import_react11.useEffect)(() => {
    if (viewHeight <= 0) {
      initialization.current.follow = null;
      return;
    }
    if (activeIndex === void 0 || pointerInsideRef.current) return;
    const previous = initialization.current.follow;
    if (previous?.index === activeIndex && previous.count === items.length && previous.height === viewHeight) return;
    initialization.current.follow = { index: activeIndex, count: items.length, height: viewHeight };
    const behavior = previous?.count === items.length && previous.height === viewHeight ? preferredScrollBehavior() : "instant";
    scrollToIndex(activeIndex, "if-needed", behavior);
  }, [activeIndex, items.length, viewHeight, scrollToIndex]);
  if (items.length < 2) return null;
  const preview2 = previewIndex === void 0 ? void 0 : items[previewIndex];
  const previewPosition = virtualItems.find((item) => item.index === previewIndex);
  const fadeClasses = [TurnNavigator_default.scroller];
  if (scrollTop > 1) fadeClasses.push(TurnNavigator_default.fadeTop);
  if (scrollTop < virtualizer.getTotalSize() - viewHeight - 1) fadeClasses.push(TurnNavigator_default.fadeBottom);
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: TurnNavigator_default.slot, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "nav",
    {
      className: TurnNavigator_default.frame,
      "aria-label": t("chat.turnNavigation.label"),
      onPointerEnter: () => {
        pointerInsideRef.current = true;
      },
      onPointerLeave: () => {
        pointerInsideRef.current = false;
        setPreviewTurn(null);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { ref: scrollerRef, className: fadeClasses.join(" "), children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { ref: virtualizer.containerRef, className: TurnNavigator_default.marks, children: virtualItems.map(({ index, key: key19 }) => {
          const item = items[index];
          if (item === void 0) return null;
          return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
            TurnMark,
            {
              item,
              index,
              active: item.turn === activeTurn,
              busy: item.turn === busyTurn,
              previewId: item.turn === previewTurn ? previewId : void 0,
              registerElement: virtualizer.measureElement,
              onNavigate,
              onPreview: setPreviewTurn,
              onFocusChange,
              t
            },
            key19
          );
        }) }) }),
        preview2 !== void 0 && previewPosition !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
          "div",
          {
            id: previewId,
            role: "tooltip",
            className: TurnNavigator_default.preview,
            style: {
              "--turn-preview-center": `${String(previewPosition.start + previewPosition.size / 2 - scrollTop)}px`
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: TurnNavigator_default.previewPrompt, children: preview2.prompt || t("chat.turnNavigation.turn", { turn: preview2.turn }) }),
              preview2.response !== "" && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { className: TurnNavigator_default.previewResponse, children: preview2.response })
            ]
          }
        )
      ]
    }
  ) });
}
var TurnNavigator = (0, import_react11.memo)((0, import_react11.forwardRef)(TurnNavigatorRail));

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-brand/lib/index.js
function brandString(value) {
  return value;
}
function brandNumber(value) {
  return value;
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-session/lib/types/types.js
function SessionSeq(value) {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`SessionSeq must be a non-negative safe integer, got ${String(value)}`);
  }
  return brandNumber(value);
}

// chat/turn-rail-items.ts
var EMPTY_ITEMS = [];
function outlineEntry(value) {
  if (typeof value !== "object" || value === null) return void 0;
  const entry = value;
  if (typeof entry.turn !== "number" || !Number.isSafeInteger(entry.turn) || entry.turn < 0) return void 0;
  if (typeof entry.seq !== "number" || !Number.isSafeInteger(entry.seq) || entry.seq < 0 || Object.is(entry.seq, -0)) return void 0;
  return {
    turn: entry.turn,
    seq: SessionSeq(entry.seq),
    prompt: typeof entry.prompt === "string" ? entry.prompt : "",
    response: typeof entry.response === "string" ? entry.response : ""
  };
}
function outlineEntries(outline) {
  return Array.isArray(outline) ? outline : EMPTY_ITEMS;
}
function mergeTurnRailItems(loaded, outline) {
  const byTurn = /* @__PURE__ */ new Map();
  for (const raw of outlineEntries(outline)) {
    const entry = outlineEntry(raw);
    if (entry === void 0) continue;
    byTurn.set(entry.turn, {
      turn: entry.turn,
      prompt: entry.prompt,
      response: entry.response,
      anchor: { kind: "unloaded", seq: entry.seq }
    });
  }
  for (const item of loaded) {
    const preview2 = byTurn.get(item.turn);
    byTurn.set(item.turn, {
      turn: item.turn,
      prompt: item.prompt !== "" ? item.prompt : preview2?.prompt ?? "",
      response: item.response !== "" ? item.response : preview2?.response ?? "",
      anchor: { kind: "loaded", key: item.anchorKey }
    });
  }
  if (byTurn.size === 0) return EMPTY_ITEMS;
  return [...byTurn.values()].sort((left, right) => left.turn - right.turn);
}

// chat/use-chat-scroll.ts
var import_react15 = require("react");

// chat/use-chat-navigation.ts
var import_react12 = require("react");
var ChatNavigation = class {
  constructor(viewport, reading, input, onBusyTurn) {
    this.viewport = viewport;
    this.reading = reading;
    this.input = input;
    this.onBusyTurn = onBusyTurn;
  }
  jump = null;
  settleFrame = null;
  /**
   * Adopt committed history availability without starting a request.
   * @param input - history state from the latest committed render.
   */
  setInput(input) {
    this.input = input;
  }
  /** Cancel navigation when opening a Chat view. */
  reset() {
    this.cancel();
  }
  /** Cancel local callbacks; late history completions cannot revive a task. */
  dispose() {
    this.clearTask();
  }
  /** Release the jump, paging anchor, and busy indicator without cancelling shared history I/O. */
  cancel() {
    this.clearTask();
    this.onBusyTurn(null);
  }
  clearTask() {
    this.cancelFrame();
    this.jump = null;
    this.viewport.stopPreserving();
  }
  /**
   * Replace the current jump with an explicit turn selection.
   * @param item - loaded anchor or unloaded turn to fetch before landing.
   */
  navigateToTurn = (item) => {
    if (item.anchor.kind === "loaded") {
      this.cancel();
      const landing = this.viewport.scrollToTurn(item.turn);
      if (landing === null) return;
      this.reading.acceptNavigation(landing);
      if (this.input.loadingOlder) this.viewport.beginPreserving(landing.position);
      return;
    }
    this.cancel();
    this.viewport.beginPreserving();
    this.reading.pauseFollowing();
    const jump = {
      turn: item.turn,
      seq: item.anchor.seq,
      phase: "loading",
      landing: "pending",
      repageHead: null
    };
    this.jump = jump;
    this.onBusyTurn(jump.turn);
    this.request(jump);
  };
  /** Request one older page while retaining the current semantic position. */
  loadEarlier = () => {
    this.cancel();
    this.viewport.beginPaging();
    this.reading.pauseFollowing();
    this.input.loadOlder();
  };
  /**
   * Preserve reader ownership across pending history work.
   * @param sample - settled reader movement that can update or interrupt an anchor.
   */
  readerSampled(sample) {
    if (sample.movedByReader && this.jump?.landing === "landed") this.jump.landing = "interrupted";
    if (sample.followingTail || sample.movedByReader) this.viewport.stopPreserving();
  }
  /**
   * Preserve one paging anchor after a commit or a later size change, regardless of head identity.
   * @returns whether the retained anchor handled the layout change.
   */
  contentCommitted() {
    if (!this.viewport.preserving || this.reading.pending) return false;
    if (this.landJump(false)) return true;
    const landing = this.viewport.preserve();
    if (landing === null) return false;
    this.reading.preservePosition(landing);
    return true;
  }
  /** Retarget a still-loading page only after inner or outer reader scrolling ends. */
  readerSettled() {
    if (this.input.loadingOlder && this.jump === null && !this.viewport.preserving && !this.reading.followingTail) {
      this.viewport.beginPreserving();
    }
  }
  /** Land, retry, or complete the current jump against the committed window. */
  reconcile() {
    const jump = this.jump;
    if (jump === null || this.reading.pending) return;
    if (jump.phase === "loading") {
      if (jump.landing === "pending") this.landJump(false);
      return;
    }
    if (this.input.loadingOlder) return;
    if (this.landJump(true)) return;
    const uncovered = this.input.firstSeq === null || this.input.firstSeq > jump.seq;
    if (uncovered && this.input.hasMore && jump.repageHead !== this.input.firstSeq) {
      jump.repageHead = this.input.firstSeq;
      this.viewport.beginPreserving();
      this.request(jump);
      return;
    }
    const fallback = this.viewport.scrollToTurnAtOrAfter(jump.turn);
    this.cancel();
    if (fallback !== null) this.reading.acceptNavigation(fallback);
  }
  landJump(settle) {
    const jump = this.jump;
    if (jump === null) return false;
    if (jump.landing === "interrupted") {
      if (settle) {
        this.cancel();
        return true;
      }
      return false;
    }
    const landing = this.viewport.scrollToTurn(jump.turn);
    if (landing === null) return false;
    this.reading.acceptNavigation(landing);
    if (settle) this.cancel();
    else {
      this.viewport.beginPreserving(landing.position);
      jump.landing = "landed";
    }
    return true;
  }
  request(jump) {
    jump.phase = "loading";
    const settled = () => {
      if (this.jump !== jump) return;
      jump.phase = "settled";
      this.cancelFrame();
      if (typeof requestAnimationFrame !== "function") this.reconcile();
      else this.settleFrame = requestAnimationFrame(() => {
        this.settleFrame = null;
        if (this.jump === jump) this.reconcile();
      });
    };
    void this.input.loadThrough(jump.seq).then(settled, settled);
  }
  cancelFrame() {
    if (this.settleFrame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.settleFrame);
    this.settleFrame = null;
  }
};
function useChatNavigation(viewport, reading, input) {
  const [busyTurn, setBusyTurn] = (0, import_react12.useState)(null);
  const [navigation] = (0, import_react12.useState)(() => new ChatNavigation(viewport, reading, input, setBusyTurn));
  (0, import_react12.useLayoutEffect)(() => {
    navigation.setInput(input);
  }, [navigation, input]);
  (0, import_react12.useLayoutEffect)(() => () => {
    navigation.dispose();
  }, [navigation]);
  return { navigation, busyTurn };
}

// chat/use-chat-reading.ts
var import_react13 = require("react");
var FOLLOW_THRESHOLD = 24;
var SCROLL_SAMPLE_INTERVAL_MS = 500;
var ChatReading = class {
  constructor(viewport, store, state, onChange) {
    this.viewport = viewport;
    this.store = store;
    this.state = state;
    this.onChange = onChange;
  }
  sampleTimer = null;
  probeFrame = null;
  sampled = null;
  /**
   * Expose pending reader ownership to navigation and resize handlers.
   * @returns whether reader input still awaits interval or scrollend sampling.
   */
  get pending() {
    return this.sampleTimer !== null;
  }
  /**
   * Expose the active follow policy.
   * @returns whether content growth retains bottom-follow ownership.
   */
  get followingTail() {
    return this.state.followingTail;
  }
  /**
   * Adopt the committed Session's scroll memory.
   * @param store - scroll memory for the current Session.
   */
  setStore(store) {
    this.store = store;
  }
  /**
   * Connect history policy to settled reading observations.
   * @param sampled - receives settled reader positions.
   * @returns a disposer that disconnects only this listener.
   */
  connect(sampled) {
    this.sampled = sampled;
    return () => {
      if (this.sampled === sampled) this.sampled = null;
    };
  }
  /** Cancel timers and animation frames and detach the sample listener. */
  dispose() {
    this.cancelPending();
    this.sampled = null;
  }
  /** Release bottom follow and pending sampling for an explicit navigation. */
  pauseFollowing() {
    this.cancelPending();
    this.publish({ ...this.state, followingTail: false });
  }
  /** Land at the current floor and clear saved reader position. */
  followTail() {
    const landing = this.viewport.scrollToBottom();
    if (landing === null) return;
    this.cancelPending();
    this.commit(landing, true, this.viewport.latestTurn);
  }
  /** Restore the Session's semantic position, or follow the tail when none is saved. */
  restore() {
    const saved = this.store.read();
    if (saved === null) {
      this.followTail();
      return;
    }
    const landing = this.viewport.restore(saved);
    if (landing === null) return;
    this.cancelPending();
    const following = this.nearBottom(landing.metrics);
    this.commit(landing, following, following ? this.viewport.latestTurn : this.state.activeTurn, following);
    if (!this.state.followingTail && landing.position === null) {
      const position = this.viewport.capturePosition();
      if (position !== null) this.store.save(position);
    }
    this.refreshActiveTurn();
  }
  /**
   * Adopt a known landing without rediscovering its anchor.
   * @param landing - measured navigation result that replaces pending reader input.
   */
  acceptNavigation(landing) {
    this.cancelPending();
    const following = this.nearBottom(landing.metrics);
    this.commit(landing, following, landing.turn ?? (following ? this.viewport.latestTurn : this.state.activeTurn));
  }
  /**
   * Retain reading policy while history changes the anchor's geometry.
   * @param landing - compensated position that retains the current reading policy.
   */
  preservePosition(landing) {
    this.cancelPending();
    this.commit(landing, this.state.followingTail, this.state.activeTurn);
  }
  /**
   * Handle pinned layout movement and reader arrivals at the floor immediately.
   * @param scroll - attributed scroll delivery; other reader movement remains pending until sampled.
   */
  onScroll = (scroll) => {
    if (!scroll.movedByReader && this.state.followingTail || scroll.movedByReader && scroll.metrics.top >= scroll.metrics.floor) {
      this.followTail();
      this.sampled?.({ position: null, movedByReader: scroll.movedByReader, followingTail: true });
      return;
    }
    this.sampleTimer ??= window.setTimeout(this.flushSample, SCROLL_SAMPLE_INTERVAL_MS);
  };
  /** Settle pending reader movement at the browser's scrollend. */
  onScrollEnd = () => {
    this.flushSample();
  };
  /** Reconcile a layout change without overriding unsampled reader input. */
  onResize() {
    if (this.pending) return;
    if (this.state.followingTail) this.followTail();
    else this.refreshActiveTurn();
  }
  /** Resolve the active turn from tail ownership or a coalesced reading-line probe. */
  refreshActiveTurn() {
    if (this.pending) return;
    if (this.state.followingTail) {
      this.publish({ ...this.state, initialized: true, activeTurn: this.viewport.latestTurn });
      return;
    }
    if (this.probeFrame !== null) return;
    if (typeof requestAnimationFrame !== "function") this.probe();
    else this.probeFrame = requestAnimationFrame(this.probe);
  }
  nearBottom(metrics) {
    return metrics.floor - metrics.top <= FOLLOW_THRESHOLD + 1;
  }
  commit(landing, followingTail, activeTurn, initialized = true) {
    if (followingTail) this.store.save(null);
    else if (landing.position !== null) this.store.save(landing.position);
    this.publish({ initialized, followingTail, activeTurn });
  }
  publish(state) {
    if (state.initialized === this.state.initialized && state.followingTail === this.state.followingTail && state.activeTurn === this.state.activeTurn) return;
    this.state = state;
    this.onChange(state);
  }
  cancelPending() {
    if (this.sampleTimer !== null) window.clearTimeout(this.sampleTimer);
    if (this.probeFrame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.probeFrame);
    this.sampleTimer = null;
    this.probeFrame = null;
  }
  probe = () => {
    this.probeFrame = null;
    if (this.pending) return;
    const scroll = this.viewport.readScroll();
    if (scroll === null) return;
    const activeTurn = this.nearBottom(scroll.metrics) ? this.viewport.latestTurn : this.viewport.readVisibleTurn(scroll.metrics);
    this.publish({ ...this.state, initialized: true, activeTurn });
  };
  flushSample = () => {
    if (!this.pending) return;
    this.cancelPending();
    const scroll = this.viewport.readScroll();
    if (scroll === null) return;
    const followingTail = scroll.movedByReader ? this.nearBottom(scroll.metrics) : this.state.followingTail;
    let position = null;
    if (!scroll.movedByReader && followingTail) this.followTail();
    else {
      position = followingTail ? null : this.viewport.capturePosition();
      this.viewport.acknowledge(scroll.metrics);
      if (followingTail || position !== null) this.store.save(position);
      const activeTurn = this.nearBottom(scroll.metrics) ? this.viewport.latestTurn : this.viewport.readVisibleTurn(scroll.metrics);
      this.publish({ initialized: true, followingTail, activeTurn });
    }
    this.sampled?.({ position, movedByReader: scroll.movedByReader, followingTail });
  };
};
function useChatReading(viewport, store, initialTurn) {
  const [state, setState] = (0, import_react13.useState)(() => ({
    initialized: false,
    followingTail: store.read() === null,
    activeTurn: initialTurn
  }));
  const [reading] = (0, import_react13.useState)(() => new ChatReading(viewport, store, state, setState));
  (0, import_react13.useLayoutEffect)(() => {
    reading.setStore(store);
  }, [reading, store]);
  (0, import_react13.useLayoutEffect)(() => () => {
    reading.dispose();
  }, [reading]);
  return { reading, state };
}

// chat/use-chat-viewport.ts
var import_react14 = require("react");
var READING_INTENTS = ["wheel", "touchstart", "pointerdown", "keydown", "beforematch"];
var SCROLL_KEYS = /* @__PURE__ */ new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
var ChatViewport = class {
  elements = null;
  observer = null;
  events = null;
  turns = [];
  observation = { top: 0, landing: null };
  paging = null;
  /**
   * Bind to the containing scrollport and observe content and viewport sizes.
   * @param list - Chat root inside an optional shared conversation scrollport.
   * @param column - ordered outer Node/Group boxes; its size changes invalidate cached landings.
   */
  attach(list, column) {
    this.detach();
    const scroller = list.closest("[data-conversation-scroll]") ?? list;
    const composer = scroller.querySelector("[data-composer-seat]");
    const elements = { list, column, scroller, composer };
    this.elements = elements;
    scroller.addEventListener("scroll", this.onScroll, { passive: true });
    scroller.addEventListener("scrollend", this.onScrollEnd, { passive: true, capture: true });
    for (const type of READING_INTENTS) scroller.addEventListener(type, this.onIntent, { passive: true, capture: true });
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => {
        if (this.elements !== elements) return;
        this.invalidate();
        this.events?.resize();
      });
      this.observer.observe(column);
      this.observer.observe(scroller);
      if (composer !== null) this.observer.observe(composer);
    }
  }
  /** Disconnect DOM resources and clear observations for the detached view. */
  detach() {
    this.stopPreserving();
    this.elements?.scroller.removeEventListener("scroll", this.onScroll);
    this.elements?.scroller.removeEventListener("scrollend", this.onScrollEnd, true);
    for (const type of READING_INTENTS) this.elements?.scroller.removeEventListener(type, this.onIntent, true);
    this.observer?.disconnect();
    this.observer = null;
    this.elements = null;
    this.events = null;
    this.turns = [];
    this.observation = { top: 0, landing: null };
  }
  /**
   * Connect business policy without changing DOM listener ownership.
   * @param events - business handlers for scroll and layout changes.
   * @returns a disposer that disconnects only these handlers.
   */
  connect(events) {
    this.events = events;
    return () => {
      if (this.events === events) this.events = null;
    };
  }
  /**
   * Adopt the loaded turn anchors without querying the DOM.
   * @param turns - ordered loaded turns from the committed Chat snapshot.
   */
  updateTurns(turns) {
    this.turns = turns;
  }
  /**
   * Resolve the tail from the committed turn index.
   * @returns the latest loaded turn, or null for an empty window.
   */
  get latestTurn() {
    return this.turns.at(-1)?.turn ?? null;
  }
  /** Discard geometry-dependent landing knowledge while retaining scroll attribution. */
  invalidate() {
    this.observation.landing = null;
  }
  /**
   * Accept a sampled reader position without retaining a known landing.
   * @param metrics - settled reader position used as the next attribution baseline.
   */
  acknowledge(metrics) {
    this.observation = { top: metrics.top, landing: null };
  }
  /**
   * Compare the current scroll geometry with the last acknowledged position.
   * @returns current metrics and movement attribution, or null while detached.
   */
  readScroll() {
    const metrics = this.metrics();
    if (metrics === null) return null;
    return {
      metrics,
      movedByReader: Math.abs(metrics.top - Math.min(this.observation.top, metrics.floor)) > 0.5
    };
  }
  metrics() {
    const scroller = this.elements?.scroller;
    if (scroller === void 0) return null;
    const height = scroller.clientHeight;
    return { top: scroller.scrollTop, height, floor: Math.max(0, scroller.scrollHeight - height) };
  }
  anchor(key19, identity = "position") {
    if (this.elements === null) return null;
    let nodePart = null;
    for (const row of this.elements.list.querySelectorAll("[data-chat-anchor-key]:not([hidden]):not([hidden] *)")) {
      if (row.dataset.chatAnchorKey === key19 || identity === "node" && row.dataset.chatNodeKey === key19) return row;
      if (nodePart === null && row.dataset.chatNodeKey === key19) nodePart = row;
    }
    return nodePart;
  }
  /**
   * Capture visible transcript content, excluding Turn controls that relocate when history expands.
   * @returns a visible semantic anchor, or null when no anchor can be resolved.
   */
  capturePosition() {
    const elements = this.elements;
    if (elements === null) return null;
    const { list, scroller, composer } = elements;
    const viewport = scroller.getBoundingClientRect();
    const bottom = composer?.getBoundingClientRect().top ?? viewport.bottom;
    let anchor = null;
    if (typeof document.elementsFromPoint === "function" && bottom > viewport.top) {
      const content = list.getBoundingClientRect();
      const left = Math.max(viewport.left, content.left);
      const right = Math.min(viewport.right, content.right);
      for (const element of document.elementsFromPoint(left + Math.max(0, right - left) / 2, viewport.top + 1)) {
        const row = element instanceof HTMLElement ? element.closest("[data-chat-anchor-key]") : null;
        if (row !== null && row.dataset.chatFlowKind !== "turn-process" && list.contains(row)) {
          anchor = row.dataset.chatGroupKey === void 0 ? row : row.querySelector("[data-step-process-content] > [data-chat-anchor-key]:not(:empty):not([hidden]):not([hidden] *)") ?? row;
          break;
        }
      }
    }
    if (anchor === null) {
      const rows = list.querySelectorAll(
        '[data-chat-flow-key]:not([data-chat-group-key]):not([data-chat-flow-kind="turn-process"]):not(:empty):not([hidden]):not([hidden] *)'
      );
      let low = 0;
      let high = rows.length;
      while (low < high) {
        const middle = low + high >>> 1;
        if (rows.item(middle).getBoundingClientRect().bottom > viewport.top) high = middle;
        else low = middle + 1;
      }
      const row = rows[low];
      anchor = row !== void 0 && row.getBoundingClientRect().top < bottom ? row : rows[0] ?? null;
    }
    const key19 = anchor?.dataset.chatAnchorKey;
    return anchor === null || key19 === void 0 ? null : {
      anchorKey: key19,
      anchorTop: anchor.getBoundingClientRect().top - viewport.top,
      scrollTop: scroller.scrollTop
    };
  }
  /**
   * Approximate the active Turn by binary-searching outer Node/Group boxes.
   * Gaps retain the last visited Turn candidate, not necessarily the immediate predecessor.
   * A known landing bypasses measurement while its position is unchanged.
   * @param metrics - reusable scroll metrics; omitted callers request a fresh read.
   * @returns the Turn near the reading line, or null while detached or empty.
   */
  readVisibleTurn(metrics = this.metrics()) {
    const knownTurn = this.observation.landing?.turn;
    if (knownTurn != null && metrics?.top === this.observation.top) return knownTurn;
    const elements = this.elements;
    const first = this.turns[0];
    if (elements === null || metrics === null || first === void 0) return null;
    const line = elements.scroller.getBoundingClientRect().top + Math.min(96, metrics.height * 0.2);
    const rows = elements.column.children;
    let low = 0;
    let high = rows.length;
    let reading = first.turn;
    while (low < high) {
      const middle = low + high >>> 1;
      const row = rows[middle];
      if (row.getBoundingClientRect().top > line) high = middle;
      else {
        const value = row.getAttribute("data-chat-turn");
        const turn = value === null ? NaN : Number(value);
        if (Number.isSafeInteger(turn)) reading = turn;
        low = middle + 1;
      }
    }
    return reading;
  }
  /**
   * Align a known loaded turn and return its actual clamped position.
   * A split Node anchor selects its first visible part.
   * @param turn - loaded turn to align below the scrollport's top edge.
   * @returns the actual landing, or null when its anchor is unavailable.
   */
  scrollToTurn(turn) {
    const item = this.turns.find((candidate) => candidate.turn === turn);
    if (item === void 0) return null;
    const row = this.anchor(item.anchorKey, "node");
    return row === null ? null : this.align(row, 24, turn);
  }
  /**
   * Align the nearest available fallback for an unavailable turn anchor.
   * @param turn - minimum turn number for a mounted fallback row.
   * @returns the fallback landing, or null when no eligible row exists.
   */
  scrollToTurnAtOrAfter(turn) {
    if (this.elements === null) return null;
    for (const row of this.elements.list.querySelectorAll("[data-chat-turn]:not([hidden]):not([hidden] *)")) {
      const candidate = Number(row.dataset.chatTurn);
      if (Number.isSafeInteger(candidate) && candidate >= turn) return this.align(row, 24, candidate);
    }
    return null;
  }
  /**
   * Restore a semantic anchor with a raw-position fallback.
   * @param position - semantic scroll memory; raw top is used only if its row is absent.
   * @returns the actual landing, or null while detached.
   */
  restore(position) {
    const row = this.anchor(position.anchorKey);
    if (row !== null) return this.align(row, position.anchorTop, null);
    const metrics = this.metrics();
    return metrics === null ? null : this.write(position.scrollTop, metrics, null);
  }
  /** Retain the first eligible transcript seat in DOM order; selection reads no geometry. */
  beginPaging() {
    this.stopPreserving();
    const row = this.elements?.list.querySelector(
      "[data-chat-paging-anchor]:not(:empty):not([hidden]):not([hidden] *)"
    );
    if (row != null) this.retain(row);
  }
  /**
   * Retain one old row and its inner/outer offsets for paging and later content growth.
   * @param position - an explicit landing to retain; omitted callers capture the current reading position.
   */
  beginPreserving(position = this.capturePosition()) {
    this.stopPreserving();
    if (position === null) return;
    const row = this.anchor(position.anchorKey);
    if (row === null) return;
    this.retain(row, position);
  }
  retain(row, position, groupTop) {
    const elements = this.elements;
    const key19 = row.dataset.chatAnchorKey;
    if (elements === null || key19 === void 0) return null;
    const previous = this.paging?.group;
    if (previous != null) this.observer?.unobserve(previous.content);
    const top = row.getBoundingClientRect().top;
    const body = row.closest("[data-step-process-body]");
    const content = body?.querySelector("[data-step-process-content]");
    const group = body === null || content == null ? null : { body, content, top: groupTop ?? top - body.getBoundingClientRect().top };
    this.paging = {
      row,
      group,
      position: position ?? {
        anchorKey: key19,
        anchorTop: top - elements.scroller.getBoundingClientRect().top,
        scrollTop: elements.scroller.scrollTop
      }
    };
    if (group !== null) this.observer?.observe(group.content);
    return this.paging;
  }
  /** Release paging ownership and its content-size observation. */
  stopPreserving() {
    const group = this.paging?.group;
    if (group != null) this.observer?.unobserve(group.content);
    this.paging = null;
  }
  /**
   * Expose retained paging ownership to navigation and resize policy.
   * @returns whether a paging row is retained for subsequent layout changes.
   */
  get preserving() {
    return this.paging !== null;
  }
  /**
   * Compensate inner scrolling first, then the outer scrollport, within their actual scroll ranges.
   * @returns the actual landing, or null when no visible retained row remains.
   */
  preserve() {
    let paging = this.paging;
    const elements = this.elements;
    if (paging === null || elements === null) return null;
    if (!elements.list.contains(paging.row)) {
      const replacement = this.anchor(paging.position.anchorKey);
      if (replacement === null) {
        this.stopPreserving();
        return null;
      }
      paging = this.retain(replacement, paging.position, paging.group?.top);
      if (paging === null) return null;
    }
    const { row, group, position } = paging;
    if (row.closest("[hidden]") !== null || row.matches(":empty")) {
      this.stopPreserving();
      return null;
    }
    if (group !== null && group.body.contains(row)) {
      const top2 = row.getBoundingClientRect().top - group.body.getBoundingClientRect().top;
      const floor = Math.max(0, group.body.scrollHeight - group.body.clientHeight);
      const target2 = Math.max(0, Math.min(floor, group.body.scrollTop + top2 - group.top));
      if (group.body.scrollTop !== target2) group.body.scrollTop = target2;
    }
    const metrics = this.metrics();
    if (metrics === null) return null;
    const top = row.getBoundingClientRect().top - elements.scroller.getBoundingClientRect().top;
    const target = metrics.top + top - position.anchorTop;
    return this.write(target, metrics, null, { key: position.anchorKey, top });
  }
  /**
   * Align the scrollport with its current floor.
   * @returns the actual floor landing, or null while detached.
   */
  scrollToBottom() {
    const metrics = this.metrics();
    return metrics === null ? null : this.write(metrics.floor, metrics, this.latestTurn);
  }
  align(row, offset, turn) {
    const metrics = this.metrics();
    if (metrics === null || this.elements === null) return null;
    const top = row.getBoundingClientRect().top - this.elements.scroller.getBoundingClientRect().top;
    return this.write(metrics.top + top - offset, metrics, turn, { key: row.dataset.chatAnchorKey, top });
  }
  write(target, metrics, turn, anchor) {
    if (this.elements === null) return null;
    const top = Math.max(0, Math.min(metrics.floor, target));
    if (top !== metrics.top) this.elements.scroller.scrollTop = top;
    const actual = this.elements.scroller.scrollTop;
    const landing = {
      metrics: { ...metrics, top: actual },
      turn,
      position: anchor?.key === void 0 ? null : {
        anchorKey: anchor.key,
        anchorTop: anchor.top - (actual - metrics.top),
        scrollTop: actual
      }
    };
    this.observation = { top: actual, landing };
    return landing;
  }
  onScroll = (event) => {
    if (this.elements === null || event.target !== this.elements.scroller) return;
    if (this.observation.landing !== null && this.elements.scroller.scrollTop === this.observation.top) return;
    this.invalidate();
    if (this.paging !== null) {
      this.events?.resize();
      return;
    }
    const scroll = this.readScroll();
    if (scroll !== null) this.events?.scroll(scroll);
  };
  onScrollEnd = (event) => {
    if (event.target === this.elements?.scroller || event.target instanceof HTMLElement && event.target.hasAttribute("data-step-process-body")) this.events?.scrollEnd();
  };
  onIntent = (event) => {
    if (event.type === "keydown" || event.type === "pointerdown") {
      if (event.target instanceof Element && event.target.closest("[data-composer-seat]") !== null) return;
      if (event.type === "keydown" && (!(event instanceof KeyboardEvent) || !SCROLL_KEYS.has(event.key))) return;
    }
    if (this.paging === null) return;
    this.stopPreserving();
    this.events?.interact();
  };
};
function useChatViewport() {
  const listRef = (0, import_react14.useRef)(null);
  const columnRef = (0, import_react14.useRef)(null);
  const [viewport] = (0, import_react14.useState)(() => new ChatViewport());
  (0, import_react14.useLayoutEffect)(() => {
    if (listRef.current === null || columnRef.current === null) return;
    viewport.attach(listRef.current, columnRef.current);
    return () => {
      viewport.detach();
    };
  }, [viewport]);
  return { viewport, listRef, columnRef };
}

// chat/use-chat-scroll.ts
function useChatScroll(input) {
  const {
    ready,
    order,
    firstSeq,
    lastKey,
    lastIsUser,
    steeringId,
    submissionId,
    running,
    loadedTurns,
    chatScroll,
    hasMore,
    loadingOlder,
    loadOlder,
    loadThrough
  } = input;
  const { viewport, listRef, columnRef } = useChatViewport();
  const { reading, state } = useChatReading(viewport, chatScroll, loadedTurns.at(-1)?.turn ?? null);
  const navigationInput = (0, import_react15.useMemo)(() => ({
    firstSeq,
    loadingOlder,
    hasMore,
    loadOlder,
    loadThrough
  }), [firstSeq, loadingOlder, hasMore, loadOlder, loadThrough]);
  const { navigation, busyTurn } = useChatNavigation(viewport, reading, navigationInput);
  const content = (0, import_react15.useRef)({
    input,
    applied: null,
    opened: false
  });
  const processContent = (0, import_react15.useCallback)(() => {
    const current = content.current.input;
    const previous = content.current.applied;
    const ownInput = current.lastIsUser && current.lastKey !== previous?.lastKey || current.steeringId !== null && current.steeringId !== previous?.steeringId && current.steeringId !== previous?.submissionId || current.submissionId !== null && current.submissionId !== previous?.submissionId && current.submissionId !== previous?.steeringId;
    if (reading.pending && !ownInput) return;
    content.current.applied = current;
    if (current.ready && !content.current.opened) {
      content.current.opened = true;
      navigation.reset();
      reading.restore();
      return;
    }
    if (ownInput) {
      navigation.cancel();
      reading.followTail();
      return;
    }
    if (navigation.contentCommitted()) {
      navigation.reconcile();
      return;
    }
    const tipChanged = previous === null || current.ready !== previous.ready || current.firstSeq !== previous.firstSeq || current.lastKey !== previous.lastKey || current.order.length !== previous.order.length || current.running !== previous.running || current.steeringId !== previous.steeringId || current.submissionId !== previous.submissionId;
    if (tipChanged && reading.followingTail) {
      navigation.cancel();
      reading.followTail();
    } else navigation.reconcile();
  }, [reading, navigation]);
  (0, import_react15.useLayoutEffect)(() => {
    const disconnectViewport = viewport.connect({
      scroll: reading.onScroll,
      scrollEnd: () => {
        reading.onScrollEnd();
        navigation.readerSettled();
      },
      interact: () => {
        navigation.cancel();
      },
      resize: () => {
        if (!navigation.contentCommitted()) reading.onResize();
        navigation.reconcile();
      }
    });
    const disconnectReading = reading.connect((sample) => {
      navigation.readerSampled(sample);
      processContent();
    });
    return () => {
      disconnectViewport();
      disconnectReading();
      content.current.opened = false;
      content.current.applied = null;
    };
  }, [viewport, reading, navigation, processContent]);
  (0, import_react15.useLayoutEffect)(() => {
    const previous = content.current.input;
    content.current.input = {
      ready,
      order,
      lastKey,
      lastIsUser,
      steeringId,
      submissionId,
      running,
      loadedTurns,
      chatScroll,
      ...navigationInput
    };
    viewport.updateTurns(loadedTurns);
    const layoutChanged = previous.order !== order || previous.ready !== ready;
    if (layoutChanged) viewport.invalidate();
    processContent();
    if (layoutChanged) reading.refreshActiveTurn();
  }, [
    viewport,
    reading,
    processContent,
    navigationInput,
    ready,
    order,
    lastKey,
    lastIsUser,
    steeringId,
    submissionId,
    running,
    loadedTurns,
    chatScroll
  ]);
  const returnToBottom = (0, import_react15.useCallback)(() => {
    navigation.cancel();
    reading.followTail();
  }, [navigation, reading]);
  return {
    listRef,
    columnRef,
    ...state,
    busyTurn,
    navigateToTurn: navigation.navigateToTurn,
    loadEarlier: navigation.loadEarlier,
    returnToBottom
  };
}

// chat/ChatView.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var import_react17 = require("react");
function openFailureMessage(error, fallback) {
  const message = error instanceof Error ? error.message : String(error);
  return message === "" ? fallback : message;
}
function observedRpcIds(order, nodes, inbox) {
  const observed = /* @__PURE__ */ new Set();
  for (const key19 of order) {
    const node = nodes.get(key19);
    if (node === void 0 || node.kind !== "user" && node.kind !== "steering") continue;
    const source = node.data.source;
    if (source?.kind === "user" && typeof source.rpcId === "string") observed.add(source.rpcId);
  }
  const pending = /* @__PURE__ */ new Set();
  for (const { source } of [...inbox?.["next-turn"] ?? [], ...inbox?.["next-step"] ?? []]) {
    if (source.kind === "user" && "rpcId" in source) pending.add(source.rpcId);
  }
  return { durable: observed, pending };
}
var ChatNodeList = (0, import_react16.memo)(function ChatNodeList2({ entries, useChatGroup, ...seatProps }) {
  return entries.map((entry) => {
    switch (entry.kind) {
      case "node":
        return /* @__PURE__ */ (0, import_react17.createElement)(
          ChatNodeSeat,
          {
            ...seatProps,
            key: chatRenderKey(entry),
            nodeKey: entry.key,
            ...entry.groupPart === void 0 ? {} : { groupPart: entry.groupPart }
          }
        );
      case "group":
        return /* @__PURE__ */ (0, import_react17.createElement)(ChatGroupSeat, { ...seatProps, key: chatRenderKey(entry), groupKey: entry.key, useChatGroup });
      default:
        return assertNever(entry);
    }
  });
});
function ChatView({
  useSession,
  useChat,
  useChatNode,
  useChatNodeProcess,
  useChatGroup,
  useConversation,
  useSessions,
  useStore,
  actions,
  renderSlot,
  sessionId,
  openFile,
  openSkill,
  openExternalLink,
  loadOlder,
  loadThrough,
  loadImage,
  inspectCall,
  chatScroll,
  forkAt,
  fileMentions,
  usePresentation,
  useProjection,
  t
}) {
  const order = useChat((s) => s.order);
  const groupedEntries = useConversation((snapshot2) => snapshot2.views.grouped("chat")?.entries);
  const entries = (0, import_react16.useMemo)(() => groupedEntries ?? order.map((key19) => ({ kind: "node", key: key19 })), [groupedEntries, order]);
  const nodeStore = useChat((s) => s.nodes);
  const turnNavigationItems = useChat((s) => s.navigation.items());
  const turnOutline = useProjection("turnOutline");
  const railItems = (0, import_react16.useMemo)(
    () => mergeTurnRailItems(turnNavigationItems, turnOutline),
    [turnNavigationItems, turnOutline]
  );
  const inbox = useProjection("inbox");
  const cwd = useSessions((s) => s.byId[sessionId]?.cwd);
  const running = useSession((s) => s.running);
  const openState = useSession((s) => s.openState);
  const openError = useSession((s) => s.openError);
  const hasMore = useSession((s) => s.hasMore);
  const loadingOlder = useSession((s) => s.loadingOlder);
  const [fileOpenError, setFileOpenError] = (0, import_react16.useState)(null);
  const [fileOpenBusy, setFileOpenBusy] = (0, import_react16.useState)(false);
  const fileOpenRequest = (0, import_react16.useRef)(0);
  const requestOpenFile = (0, import_react16.useCallback)((path, options) => {
    const id = ++fileOpenRequest.current;
    setFileOpenBusy(true);
    void (options === void 0 ? openFile(path) : openFile(path, options)).then(
      () => {
        if (id !== fileOpenRequest.current) return;
        setFileOpenError(null);
        setFileOpenBusy(false);
      },
      (error) => {
        if (id !== fileOpenRequest.current) return;
        setFileOpenError({
          path,
          message: openFailureMessage(
            error,
            t("fileOpen.unknown")
          )
        });
        setFileOpenBusy(false);
      }
    );
  }, [openFile, t]);
  const closeFileOpenError = (0, import_react16.useCallback)(() => {
    fileOpenRequest.current += 1;
    setFileOpenError(null);
    setFileOpenBusy(false);
  }, []);
  const inboxSteering = (0, import_react16.useMemo)(
    () => inbox?.["next-step"].filter((message) => message.source.kind === "user") ?? [],
    [inbox]
  );
  const pendingSubmissions = useSession((s) => s.pendingSubmissions);
  const visibleSubmissions = (0, import_react16.useMemo)(() => {
    if (pendingSubmissions.length === 0) return pendingSubmissions;
    const observed = observedRpcIds(order, nodeStore, inbox);
    return pendingSubmissions.filter((submission) => submission.placement !== "queued" && !observed.durable.has(submission.requestId) && (submission.placement === "steering" || !observed.pending.has(submission.requestId)));
  }, [pendingSubmissions, order, nodeStore, inbox]);
  const pendingInputs = (0, import_react16.useMemo)(() => {
    const local = new Map(visibleSubmissions.map((submission) => [submission.requestId, submission]));
    const pending = inboxSteering.map((item) => {
      const source = item.source;
      if (source.kind !== "user" || !("rpcId" in source)) return item;
      const submission = local.get(source.rpcId);
      if (submission === void 0) return item;
      local.delete(source.rpcId);
      return submission;
    });
    return [...pending, ...local.values()];
  }, [inboxSteering, visibleSubmissions]);
  const renderMessageImages = (0, import_react16.useCallback)(
    (owner19) => renderSlot("conversation.message.images", { ...owner19, loadImage }),
    [loadImage, renderSlot]
  );
  const firstKey = order[0];
  const firstSeq = firstKey === void 0 ? null : nodeStore.get(firstKey)?.anchorSeq ?? null;
  const lastKey = order.at(-1) ?? null;
  const latestSteering = pendingInputs.findLast((item) => "source" in item);
  const steeringId = latestSteering?.source.kind === "user" && "rpcId" in latestSteering.source ? latestSteering.source.rpcId : latestSteering?.id ?? null;
  const scroll = useChatScroll({
    ready: openState === "open",
    order,
    firstSeq,
    lastKey,
    running,
    loadingOlder,
    hasMore,
    chatScroll,
    loadOlder,
    loadThrough,
    lastIsUser: lastKey !== null && nodeStore.get(lastKey)?.kind === "user",
    steeringId,
    submissionId: visibleSubmissions.at(-1)?.requestId ?? null,
    loadedTurns: turnNavigationItems
  });
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: ChatView_default.root, "data-chat-following-tail": scroll.followingTail ? "" : void 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { ref: scroll.listRef, className: ChatView_default.scroll, children: [
      scroll.initialized && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        TurnNavigator,
        {
          items: railItems,
          activeTurn: scroll.activeTurn,
          busyTurn: scroll.busyTurn,
          onNavigate: scroll.navigateToTurn,
          t
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { ref: scroll.columnRef, className: ChatView_default.column, "data-chat-flow": "", children: [
        openState === "loading" && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: ChatView_default.hint, children: t("chat.loadingHistory") }),
        openState === "error" && openError !== null && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: ChatView_default.openError, children: t("chat.loadError", { message: openError.message, code: openError.code }) }),
        hasMore && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: ChatView_default.older, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("button", { type: "button", disabled: loadingOlder, onClick: scroll.loadEarlier, children: loadingOlder ? t("loading") : t("chat.loadOlder") }) }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_dsh_client_ui_primitives8.MarkdownDelegateProvider, { openExternalLink, openFile: requestOpenFile, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          ChatNodeList,
          {
            entries,
            nodeStore,
            useChatGroup,
            useChatNode,
            useChatNodeProcess,
            usePresentation,
            useStore,
            actions,
            cwd,
            openFile: requestOpenFile,
            openSkill,
            inspectCall,
            forkAt,
            loadImage,
            renderMessageImages,
            fileMentions,
            renderSlot,
            t
          }
        ) }),
        pendingInputs.map((item) => "requestId" in item ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          PendingSubmissionBubble,
          {
            submission: item,
            renderMessageImages,
            t
          },
          item.requestId
        ) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          PendingSteeringBubble,
          {
            content: item.content,
            renderMessageImages,
            t
          },
          item.id
        )),
        renderSlot("conversation.chat.roleplay-progress", { hasNativePending: pendingInputs.length > 0 })
      ] }),
      !scroll.followingTail && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { className: ChatView_default.toBottomSlot, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        "button",
        {
          type: "button",
          className: ChatView_default.toBottom,
          "aria-label": t("chat.toBottom"),
          onClick: scroll.returnToBottom,
          children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_dsh_client_ui_primitives8.IconChevronDownOutlineRegular, {})
        }
      ) })
    ] }),
    fileOpenError !== null && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
      FileOpenErrorDialog,
      {
        message: fileOpenError.message,
        busy: fileOpenBusy,
        onClose: closeFileOpenError,
        onRetry: () => {
          requestOpenFile(fileOpenError.path);
        },
        t
      }
    )
  ] });
}
function FileOpenErrorDialog({
  message,
  busy,
  onClose,
  onRetry,
  t
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    import_dsh_client_ui_primitives8.Modal,
    {
      open: true,
      onClose,
      closeLabel: t("close"),
      title: t("fileOpen.title"),
      description: message,
      footer: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_jsx_runtime9.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_dsh_client_ui_primitives8.Button, { variant: "outline", className: ChatView_default.modalAction, onClick: onClose, children: t("cancel") }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_dsh_client_ui_primitives8.Button, { variant: "primary", className: ChatView_default.modalAction, disabled: busy, onClick: onRetry, children: t("retry") })
      ] })
    }
  );
}

// locale.ts
var NS = "chat";
var zh = {
  "message.stepProcess.thinking": "\u6B63\u5728\u5206\u6790\u8BF7\u6C42",
  "message.stepProcess.read": "\u6B63\u5728\u8BFB\u53D6\u6587\u4EF6",
  "message.stepProcess.search": "\u6B63\u5728\u641C\u7D22\u4EE3\u7801",
  "message.stepProcess.edit": "\u6B63\u5728\u7F16\u8F91\u6587\u4EF6",
  "message.stepProcess.commands": "\u6B63\u5728\u8FD0\u884C\u547D\u4EE4",
  "message.stepProcess.code": "\u6B63\u5728\u8FD0\u884C\u4EE3\u7801",
  "message.stepProcess.webSearch": "\u6B63\u5728\u641C\u7D22\u7F51\u9875",
  "message.stepProcess.webFetch": "\u6B63\u5728\u8BBF\u95EE\u7F51\u9875",
  "message.stepProcess.subagents": "\u6B63\u5728\u534F\u8C03\u5B50\u4EFB\u52A1",
  "message.stepProcess.plan": "\u6B63\u5728\u66F4\u65B0\u8BA1\u5212",
  "message.stepProcess.questions": "\u7B49\u5F85\u4F60\u7684\u64CD\u4F5C",
  "message.stepProcess.tools": "\u6B63\u5728\u8C03\u7528\u5DE5\u5177",
  "message.stepProcess.done.thinking": "\u5DF2\u5B8C\u6210\u5206\u6790",
  "message.stepProcess.done.read": "\u5DF2\u8BFB\u53D6\u6587\u4EF6",
  "message.stepProcess.done.search": "\u5DF2\u641C\u7D22\u4EE3\u7801",
  "message.stepProcess.done.edit": "\u4FEE\u6539\u4E86\u6587\u4EF6",
  "message.stepProcess.done.commands": "\u6267\u884C\u4E86\u547D\u4EE4",
  "message.stepProcess.done.code": "\u8FD0\u884C\u4E86\u4EE3\u7801",
  "message.stepProcess.done.webSearch": "\u5DF2\u641C\u7D22\u7F51\u9875",
  "message.stepProcess.done.webFetch": "\u5DF2\u8BBF\u95EE\u7F51\u9875",
  "message.stepProcess.done.subagents": "\u5DF2\u534F\u8C03\u5B50\u4EFB\u52A1",
  "message.stepProcess.done.plan": "\u66F4\u65B0\u4E86\u8BA1\u5212",
  "message.stepProcess.done.questions": "\u5411\u7528\u6237\u63D0\u51FA\u4E86\u95EE\u9898",
  "message.stepProcess.done.tools": "\u5DF2\u8C03\u7528\u5DE5\u5177",
  "message.stepProcess.joinTwo": "{first}\u5E76{second}",
  "message.stepProcess.comma": "\uFF0C",
  "message.stepProcess.sharedPrefix": "\u5DF2",
  "message.stepProcess.more": "{title}\u7B49",
  "message.trigger.request": "\u6536\u5230\u6267\u884C\u8BF7\u6C42",
  "message.trigger.goal": "\u7EE7\u7EED\u6267\u884C\u76EE\u6807",
  "message.trigger.agent": "\u6536\u5230\u4EFB\u52A1\u6D88\u606F",
  "message.trigger.team": "\u6536\u5230\u56E2\u961F\u6D88\u606F",
  "message.trigger.subagent": "\u5B50\u4EFB\u52A1\u72B6\u6001\u66F4\u65B0",
  "message.trigger.github": "\u6536\u5230 GitHub \u4E8B\u4EF6",
  "message.trigger.webhook": "\u6536\u5230\u5916\u90E8\u4E8B\u4EF6",
  "message.trigger.schedule": "\u5B9A\u65F6\u4EFB\u52A1",
  "message.trigger.job": "\u540E\u53F0\u4EFB\u52A1\u72B6\u6001\u66F4\u65B0",
  "message.trigger.plugin": "\u63D2\u4EF6\u72B6\u6001\u66F4\u65B0",
  "message.trigger.explanation": "\u8FD9\u6761\u901A\u77E5\u89E6\u53D1\u4E86\u672C\u8F6E\u56DE\u590D\u3002",
  "message.turnProcess.worked": "\u5DF2\u5B8C\u6210\u5DE5\u4F5C",
  "message.turnProcess.deepDivingFor": "\u6DF1\u5EA6\u6C42\u7D22\u4E2D\uFF0C\u7528\u65F6{duration}",
  "message.turnProcess.took": "\u7528\u65F6 {duration}",
  "message.turnProcess.failed": "\u5904\u7406\u5931\u8D25",
  "view.chat": "\u5BF9\u8BDD",
  "number.groupSeparator": ",",
  "duration.compactSeconds": "{seconds}\u79D2",
  "duration.compactMinutes": "{minutes}\u5206{seconds}\u79D2",
  "duration.milliseconds": "{milliseconds}\u6BEB\u79D2",
  "stats.counts": "{turns} \u8F6E {steps} \u6B65",
  "stats.cacheHit": "\u7F13\u5B58\u547D\u4E2D {percent}%",
  "stats.dialog.title": "\u4F1A\u8BDD\u7EDF\u8BA1",
  "stats.dialog.usageTitle": "Token \u7528\u91CF",
  "stats.dialog.llmTime": "\u6A21\u578B\u7528\u65F6",
  "stats.dialog.toolTime": "\u5DE5\u5177\u8C03\u7528\u7528\u65F6",
  "stats.dialog.ttft": "\u9996 token \u5E73\u5747\uFF08TTFT\uFF09",
  "stats.dialog.speed": "\u8F93\u51FA\u901F\u5EA6\uFF08TPS\uFF09",
  "chat.loadingHistory": "\u8F7D\u5165\u5386\u53F2\u2026",
  "chat.loadError": "\u5386\u53F2\u52A0\u8F7D\u5931\u8D25\uFF1A{message}\uFF08{code}\uFF09",
  "chat.loadOlder": "\u52A0\u8F7D\u66F4\u65E9",
  "chat.toBottom": "\u56DE\u5230\u5E95\u90E8",
  "chat.deepDiving": "\u6DF1\u5EA6\u6C42\u7D22\u4E2D",
  "chat.turnNavigation.label": "\u8F6E\u6B21\u5BFC\u822A",
  "chat.turnNavigation.jump": "\u8DF3\u8F6C\u5230\u7B2C {turn} \u8F6E",
  "chat.turnNavigation.jumpLoad": "\u52A0\u8F7D\u5E76\u8DF3\u8F6C\u5230\u7B2C {turn} \u8F6E",
  "chat.turnNavigation.turn": "\u7B2C {turn} \u8F6E",
  "settings.performance.title": "\u6027\u80FD\u4E0E\u7528\u91CF",
  "settings.performance.description": "\u9009\u62E9\u6027\u80FD\u4E0E\u7528\u91CF\u4FE1\u606F\u5C55\u793A\u7684\u8BE6\u7EC6\u7A0B\u5EA6",
  "settings.performance.compact": "\u7B80\u6D01",
  "settings.performance.detailed": "\u8BE6\u7EC6",
  "settings.links.title": "\u804A\u5929\u94FE\u63A5\u6253\u5F00\u65B9\u5F0F",
  "settings.links.description": "\u9009\u62E9\u804A\u5929\u4E2D HTTP(S) \u94FE\u63A5\u7684\u6253\u5F00\u4F4D\u7F6E",
  "settings.links.sidebar": "\u5185\u7F6E\u6D4F\u89C8\u5668",
  "settings.links.newTab": "\u6D4F\u89C8\u5668\u65B0\u6807\u7B7E\u9875",
  "settings.transcript.title": "\u5DE5\u4F5C\u8FC7\u7A0B\u5C55\u793A",
  "settings.transcript.description": "\u63A7\u5236\u8F6E\u6B21\u548C\u6B65\u9AA4\u7684\u9ED8\u8BA4\u5C55\u5F00\u65B9\u5F0F",
  "settings.transcript.compact": "\u7B80\u6D01",
  "settings.transcript.detailed": "\u8BE6\u7EC6",
  "settings.transcript.expanded": "\u5B8C\u5168\u5C55\u5F00",
  "fileOpen.title": "\u65E0\u6CD5\u6253\u5F00\u6587\u4EF6",
  "fileOpen.unknown": "\u65E0\u6CD5\u6253\u5F00\u6B64\u6587\u4EF6",
  "message.extraBlock": "\u9644\u52A0\u5185\u5BB9\u5757",
  "message.systemPrompt": "\u7CFB\u7EDF\u63D0\u793A\u8BCD",
  "message.systemPromptUpdate": "\u7CFB\u7EDF\u63D0\u793A\u8BCD\u66F4\u65B0",
  "message.contextInjection": "\u4E0A\u4E0B\u6587\u6CE8\u5165",
  "message.contextRecall": "\u8DE8\u4F1A\u8BDD\u53EC\u56DE",
  "message.referenceSummary": "\u5F15\u7528\u4F1A\u8BDD \xB7 {labels}",
  "message.referenceSeparator": "\u3001",
  "message.context.instructions.loaded": "\u5DF2\u8F7D\u5165",
  "message.context.instructions.added": "\u5DF2\u65B0\u589E",
  "message.context.instructions.updated": "\u5DF2\u66F4\u65B0",
  "message.context.instructions.removed": "\u5DF2\u79FB\u9664",
  "message.context.catalog.replaced": "\u66FF\u6362\u76EE\u5F55",
  "message.context.catalog.more": "\u2026\u8FD8\u6709 {count} \u6761",
  "message.context.snapshot.supersedes": "\u53D6\u4EE3\u5148\u524D\u7684\u5FEB\u7167",
  "message.context.relay.from": "\u6765\u81EA\u4F1A\u8BDD {session}",
  "message.context.recall.counts": "\u4FDD\u7559 {retained} \u6761 \xB7 \u7701\u7565 {omitted} \u6761",
  "message.context.recall.truncated": "\u5DF2\u622A\u65AD",
  "message.compaction": "\u4E0A\u4E0B\u6587\u5DF2\u538B\u7F29",
  "message.compaction.running": "\u6B63\u5728\u538B\u7F29\u2026",
  "message.compaction.completed": "\u5DF2\u538B\u7F29 {items} \u6761\u5386\u53F2\u8BB0\u5F55\uFF08\u7EA6 {tokens} tokens\uFF09",
  "message.compaction.expand": "\u70B9\u51FB\u67E5\u770B\u538B\u7F29\u6458\u8981",
  "message.compaction.unavailable": "\u538B\u7F29\u6458\u8981\u4E0D\u53EF\u7528",
  "message.compaction.commandTitle": "compact",
  "message.think": "\u601D\u8003",
  "message.unknownSurface": "\u672A\u77E5 surface \u4E8B\u4EF6\uFF1A{type}",
  "message.unknownBlock": "\u672A\u77E5\u5185\u5BB9\u5757",
  "message.turnProcess.toolCalls.one": "{count} \u6B21\u5DE5\u5177\u8C03\u7528",
  "message.turnProcess.toolCalls.other": "{count} \u6B21\u5DE5\u5177\u8C03\u7528",
  "message.turnProcess.messages.one": "{count} \u6761\u6D88\u606F",
  "message.turnProcess.messages.other": "{count} \u6761\u6D88\u606F",
  "message.turnProcess.subagents.one": "{count} \u4E2A subagent",
  "message.turnProcess.subagents.other": "{count} \u4E2A subagent",
  "message.turnProcess.thoughtForAWhile": "\u5DF2\u601D\u8003",
  "message.turnProcess.separator": " \xB7 ",
  "message.stopped": "\u5DF2\u505C\u6B62",
  "message.branch": "\u5728\u65B0\u5BF9\u8BDD\u4E2D\u5206\u652F",
  "message.branchUnavailable": "\u4EC5\u53EF\u4ECE\u5DF2\u5B8C\u6210\u8F6E\u6B21\u7684\u6700\u540E\u4E00\u6761\u6D88\u606F\u5206\u652F",
  "message.retry.active": "\u6B63\u5728\u91CD\u8BD5\u6A21\u578B\u8BF7\u6C42",
  "message.retry.cancelled": "\u6A21\u578B\u8BF7\u6C42\u91CD\u8BD5\u5DF2\u53D6\u6D88",
  "message.retry.started": "\u5DF2\u91CD\u8BD5\u6A21\u578B\u8BF7\u6C42",
  "message.retry.scheduled": "\u7B49\u5F85\u91CD\u8BD5\u6A21\u578B\u8BF7\u6C42",
  "message.retry.status": "{label}\uFF08{retry}/{maximum}\uFF09 \xB7 {seconds}s",
  "message.retry.delay": "\u91CD\u8BD5\u5EF6\u8FDF\uFF1A",
  "message.retry.failure": "\u5931\u8D25\u539F\u56E0\uFF1A",
  "message.failure.auth": "API \u5BC6\u94A5\u65E0\u6548",
  "message.turnError": "\u672C\u8F6E\u8FD0\u884C\u5931\u8D25",
  "message.maxTokens": "\u5DF2\u8FBE\u5230\u8F93\u51FA token \u4E0A\u9650",
  "message.maxTokens.hint": "\u56DE\u7B54\u88AB\u622A\u65AD\uFF0C\u5DF2\u6709\u8F93\u51FA\u4FDD\u7559\u5728\u5BF9\u8BDD\u4E2D\u3002\u53D1\u9001\u201C\u7EE7\u7EED\u201D\u53EF\u8BA9\u6A21\u578B\u63A5\u7740\u8F93\u51FA\u3002",
  "message.tokensPerSecond": "{tps} tok/s",
  "message.turnUsage.title": "\u672C\u8F6E\u7528\u91CF",
  "message.turnUsage.consumed": "\u7528\u91CF {total}",
  "message.turnUsage.model": "\u63D0\u4F9B\u65B9 / \u6A21\u578B",
  "message.turnUsage.cacheHit": "\u7F13\u5B58\u547D\u4E2D",
  "message.turnUsage.input": "\u672A\u7F13\u5B58\u8F93\u5165",
  "message.turnUsage.cacheRead": "\u7F13\u5B58\u8BFB\u53D6",
  "message.turnUsage.cacheWrite": "\u7F13\u5B58\u5199\u5165",
  "message.turnUsage.output": "\u8F93\u51FA",
  "message.turnUsage.reasoning": "\uFF08\u5176\u4E2D\u63A8\u7406 {tokens}\uFF09",
  "message.turnUsage.count": "{count} tok",
  "duration.seconds": "{seconds}\u79D2",
  "duration.minutes": "{minutes}\u5206{seconds}\u79D2",
  "duration.hours": "{hours}\u5C0F\u65F6{minutes}\u5206{seconds}\u79D2",
  "command.running": "\u6267\u884C\u4E2D\u2026",
  "command.failed": "\u6307\u4EE4\u5931\u8D25",
  "command.done": "\u5DF2\u5B8C\u6210",
  "command.title": "\u6307\u4EE4",
  "row.running": "\u8FD0\u884C\u4E2D",
  "row.failed": "\u5931\u8D25",
  "json.truncated": "\u2026 \u5DF2\u622A\u65AD\uFF0C\u5171 {total} \u5B57\u7B26",
  "clock.md": "{m}\u6708{d}\u65E5",
  "clock.ymd": "{y}\u5E74{m}\u6708{d}\u65E5"
};
var en = {
  "message.stepProcess.thinking": "Analyzing the request",
  "message.stepProcess.read": "Reading files",
  "message.stepProcess.search": "Searching code",
  "message.stepProcess.edit": "Editing files",
  "message.stepProcess.commands": "Running commands",
  "message.stepProcess.code": "Running code",
  "message.stepProcess.webSearch": "Searching the web",
  "message.stepProcess.webFetch": "Visiting web pages",
  "message.stepProcess.subagents": "Coordinating subagents",
  "message.stepProcess.plan": "Updating the plan",
  "message.stepProcess.questions": "Waiting for your action",
  "message.stepProcess.tools": "Calling tools",
  "message.stepProcess.done.thinking": "Analysis completed",
  "message.stepProcess.done.read": "Read files",
  "message.stepProcess.done.search": "Searched code",
  "message.stepProcess.done.edit": "Edited files",
  "message.stepProcess.done.commands": "Ran commands",
  "message.stepProcess.done.code": "Ran code",
  "message.stepProcess.done.webSearch": "Searched the web",
  "message.stepProcess.done.webFetch": "Visited web pages",
  "message.stepProcess.done.subagents": "Coordinated subagents",
  "message.stepProcess.done.plan": "Updated the plan",
  "message.stepProcess.done.questions": "Asked questions",
  "message.stepProcess.done.tools": "Called tools",
  "message.stepProcess.joinTwo": "{first} and {second}",
  "message.stepProcess.comma": ", ",
  "message.stepProcess.sharedPrefix": "",
  "message.stepProcess.more": "{title}, etc.",
  "message.trigger.request": "Execution requested",
  "message.trigger.goal": "Continuing goal",
  "message.trigger.agent": "Task message received",
  "message.trigger.team": "Team message received",
  "message.trigger.subagent": "Subtask status updated",
  "message.trigger.github": "GitHub event received",
  "message.trigger.webhook": "External event received",
  "message.trigger.schedule": "Scheduled task",
  "message.trigger.job": "Background task updated",
  "message.trigger.plugin": "Plugin status updated",
  "message.trigger.explanation": "This notification triggered this response.",
  "message.turnProcess.worked": "Worked",
  "message.turnProcess.deepDivingFor": "Deep diving for {duration}",
  "message.turnProcess.took": "Took {duration}",
  "message.turnProcess.failed": "Failed",
  "view.chat": "Chat",
  "number.groupSeparator": ",",
  "duration.compactSeconds": "{seconds}s",
  "duration.compactMinutes": "{minutes}m{seconds}s",
  "duration.milliseconds": "{milliseconds}ms",
  "stats.counts": "{turns} turns {steps} steps",
  "stats.cacheHit": "Cache hit {percent}%",
  "stats.dialog.title": "Session statistics",
  "stats.dialog.usageTitle": "Token usage",
  "stats.dialog.llmTime": "LLM time",
  "stats.dialog.toolTime": "Tool time",
  "stats.dialog.ttft": "Avg time to first token (TTFT)",
  "stats.dialog.speed": "Tokens per second (TPS)",
  "chat.loadingHistory": "Loading history\u2026",
  "chat.loadError": "Failed to load history: {message} ({code})",
  "chat.loadOlder": "Load earlier",
  "chat.toBottom": "Back to bottom",
  "chat.deepDiving": "Deep diving...",
  "chat.turnNavigation.label": "Turn navigation",
  "chat.turnNavigation.jump": "Jump to turn {turn}",
  "chat.turnNavigation.jumpLoad": "Load and jump to turn {turn}",
  "chat.turnNavigation.turn": "Turn {turn}",
  "settings.performance.title": "Performance & usage",
  "settings.performance.description": "Choose how much performance and usage information to show",
  "settings.performance.compact": "Compact",
  "settings.performance.detailed": "Detailed",
  "settings.links.title": "Open chat links in",
  "settings.links.description": "Choose where HTTP(S) links in chat open",
  "settings.links.sidebar": "Built-in browser",
  "settings.links.newTab": "New browser tab",
  "settings.transcript.title": "Work details",
  "settings.transcript.description": "Controls how turns and steps expand by default",
  "settings.transcript.compact": "Compact",
  "settings.transcript.detailed": "Detailed",
  "settings.transcript.expanded": "Expanded",
  "fileOpen.title": "Couldn\u2019t open file",
  "fileOpen.unknown": "Couldn\u2019t open this file",
  "message.extraBlock": "Extra content block",
  "message.systemPrompt": "System prompt",
  "message.systemPromptUpdate": "System prompt update",
  "message.contextInjection": "Context injection",
  "message.contextRecall": "Session recall",
  "message.referenceSummary": "Referenced session \xB7 {labels}",
  "message.referenceSeparator": ", ",
  "message.context.instructions.loaded": "loaded",
  "message.context.instructions.added": "added",
  "message.context.instructions.updated": "updated",
  "message.context.instructions.removed": "removed",
  "message.context.catalog.replaced": "Replacement catalog",
  "message.context.catalog.more": "\u2026 {count} more",
  "message.context.snapshot.supersedes": "Supersedes earlier snapshots",
  "message.context.relay.from": "From session {session}",
  "message.context.recall.counts": "{retained} kept \xB7 {omitted} omitted",
  "message.context.recall.truncated": "truncated",
  "message.compaction": "Context compacted",
  "message.compaction.running": "Compacting context\u2026",
  "message.compaction.completed": "Compacted {items} history items (~{tokens} tokens)",
  "message.compaction.expand": "View compaction summary",
  "message.compaction.unavailable": "Compaction summary unavailable",
  "message.compaction.commandTitle": "compact",
  "message.think": "Think",
  "message.unknownSurface": "Unknown surface event: {type}",
  "message.unknownBlock": "Unknown content block",
  "message.turnProcess.toolCalls.one": "{count} tool call",
  "message.turnProcess.toolCalls.other": "{count} tool calls",
  "message.turnProcess.messages.one": "{count} message",
  "message.turnProcess.messages.other": "{count} messages",
  "message.turnProcess.subagents.one": "{count} subagent",
  "message.turnProcess.subagents.other": "{count} subagents",
  "message.turnProcess.thoughtForAWhile": "Thought for a while",
  "message.turnProcess.separator": " \xB7 ",
  "message.stopped": "Stopped",
  "message.branch": "Branch into a new conversation",
  "message.branchUnavailable": "Available only on the last message of a completed turn",
  "message.retry.active": "Retrying model request",
  "message.retry.cancelled": "Model request retry cancelled",
  "message.retry.started": "Retried model request",
  "message.retry.scheduled": "Waiting to retry model request",
  "message.retry.status": "{label} ({retry}/{maximum}) \xB7 {seconds}s",
  "message.retry.delay": "Retry delay: ",
  "message.retry.failure": "Failure reason: ",
  "message.failure.auth": "API key is invalid",
  "message.turnError": "This turn failed",
  "message.maxTokens": "Output token limit reached",
  "message.maxTokens.hint": 'The reply was cut off; earlier output is preserved in the conversation. Send "continue" to let the model resume.',
  "message.tokensPerSecond": "{tps} tok/s",
  "message.turnUsage.title": "Turn usage",
  "message.turnUsage.consumed": "Usage {total}",
  "message.turnUsage.model": "Provider / model",
  "message.turnUsage.cacheHit": "Cache hit",
  "message.turnUsage.input": "Uncached input",
  "message.turnUsage.cacheRead": "Cached input",
  "message.turnUsage.cacheWrite": "Cache write",
  "message.turnUsage.output": "Output",
  "message.turnUsage.reasoning": " ({tokens} reasoning)",
  "message.turnUsage.count": "{count} tok",
  "duration.seconds": "{seconds}s",
  "duration.minutes": "{minutes}m {seconds}s",
  "duration.hours": "{hours}h {minutes}m {seconds}s",
  "command.running": "Running\u2026",
  "command.failed": "Command failed",
  "command.done": "Completed",
  "command.title": "Command",
  "row.running": "Running",
  "row.failed": "Failed",
  "json.truncated": "\u2026 truncated, {total} characters total",
  "clock.md": "{m}/{d}",
  "clock.ymd": "{y}-{m}-{d}"
};

// chat/AssistantNodeView.tsx
var import_react20 = require("react");

// chat/AssistantMarkdown.tsx
var import_react19 = require("react");
var import_dsh_client_ui_primitives10 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/ReasoningRow.tsx
var import_react18 = require("react");
var import_dsh_client_ui_primitives9 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/accessibility.module.css
var owner8 = "dsh-nexttavern-ui-chat";
var key8 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/accessibility.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key8)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner8;
  style.dataset.pluginCss = key8;
  style.textContent = ".m-TyZa_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";
  document.head.appendChild(style);
}
var accessibility_default = { "visuallyHidden": "m-TyZa_visuallyHidden" };

// chat/ReasoningRow.module.css
var owner9 = "dsh-nexttavern-ui-chat";
var key9 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/ReasoningRow.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key9)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner9;
  style.dataset.pluginCss = key9;
  style.textContent = '.tAMH5a_root{flex-direction:column;display:flex}.tAMH5a_root:not([data-expanded]){contain:size layout;height:calc(24px + var(--dsh-content-font-delta,0px))}.tAMH5a_row{position:relative;overflow:hidden}.tAMH5a_root[data-expanded] [data-open] [data-disclosure-row]{z-index:1;background:var(--dsw-alias-bg-base);position:sticky;top:0}.tAMH5a_root[data-state=running] .tAMH5a_row:after{content:"";inset-block:0;background:linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--dsw-alias-bg-base) 60%, transparent) 55%, transparent 100%);pointer-events:none;width:300px;animation:2.6s ease-out infinite tAMH5a_dsh-reasoning-row-sweep;position:absolute;left:0}@keyframes tAMH5a_dsh-reasoning-row-sweep{0%{left:-300px}90%,to{left:100%}}.tAMH5a_leading{flex-shrink:0}.tAMH5a_chevron{color:var(--dsw-alias-label-secondary)}.tAMH5a_title{font-weight:400}.tAMH5a_separator{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.tAMH5a_summary{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));white-space:nowrap;flex:auto;overflow:hidden}.tAMH5a_summaryText{text-overflow:ellipsis;display:block;overflow:hidden}.tAMH5a_summary[data-streaming]{mask-image:linear-gradient(90deg,#000 calc(100% - 48px),#0000)}.tAMH5a_summary[data-streaming] .tAMH5a_summaryText{text-overflow:clip;overflow:visible}.tAMH5a_root:not([data-preview]) .tAMH5a_separator,.tAMH5a_root:not([data-preview]) .tAMH5a_summary{display:none}.tAMH5a_thinkBody{padding:4px 0 4px calc(22px + var(--dsh-content-font-delta,0px));min-width:0}@media (prefers-reduced-motion:reduce){.tAMH5a_root[data-state=running] .tAMH5a_row:after{animation:none}}';
  document.head.appendChild(style);
}
var ReasoningRow_default = { "chevron": "tAMH5a_chevron", "dsh-reasoning-row-sweep": "tAMH5a_dsh-reasoning-row-sweep", "leading": "tAMH5a_leading", "root": "tAMH5a_root", "row": "tAMH5a_row", "separator": "tAMH5a_separator", "summary": "tAMH5a_summary", "summaryText": "tAMH5a_summaryText", "thinkBody": "tAMH5a_thinkBody", "title": "tAMH5a_title" };

// chat/ReasoningRow.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
var THINK_ICON = /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_dsh_client_ui_primitives9.IconThinkOutlineRegular, { size: 14 });
function firstLine(text) {
  const newline = text.indexOf("\n");
  return newline === -1 ? text : text.slice(0, newline);
}
function latestCompletedParagraphFirstLine(text) {
  let summary = "";
  let paragraphStart = 0;
  const separator = /\r?\n(?:[\t ]*\r?\n)+/g;
  while (true) {
    const nextParagraph = separator.exec(text);
    const paragraphEnd = nextParagraph === null ? text.length : nextParagraph.index + nextParagraph[0].indexOf("\n");
    const newline = text.indexOf("\n", paragraphStart);
    if (newline !== -1 && newline <= paragraphEnd) {
      const candidate = text.slice(paragraphStart, newline).trim();
      if (candidate !== "") summary = candidate;
    }
    if (nextParagraph === null) return summary;
    paragraphStart = nextParagraph.index + nextParagraph[0].length;
  }
}
var ReasoningRow = (0, import_react18.memo)(function ReasoningRow2({ text, running, usePresentation, useDisclosure: useDisclosure2, t }) {
  const { expanded, toggle } = useDisclosure2();
  const labels = (0, import_react18.useMemo)(() => markdownLabels(t), [t]);
  const summaryText = running ? latestCompletedParagraphFirstLine(text) : firstLine(text);
  const summary = (0, import_react18.useMemo)(() => summaryText.replaceAll("**", ""), [summaryText]);
  const preview2 = usePresentation((policy) => !expanded && summary !== "" && (running || policy.settledReasoningPreview));
  const collapsedContent = (0, import_react18.useMemo)(() => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: ReasoningRow_default.separator, "aria-hidden": true }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: ReasoningRow_default.summary, "data-streaming": running || void 0, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: ReasoningRow_default.summaryText, children: summary }) })
  ] }), [running, summary]);
  const content = (0, import_react18.useMemo)(() => expanded ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: ReasoningRow_default.thinkBody, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_dsh_client_ui_primitives9.MarkdownText, { text, streaming: running, labels, variant: "compact" }) }) : void 0, [expanded, labels, running, text]);
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
    "div",
    {
      className: ReasoningRow_default.root,
      "data-variant": "think",
      "data-state": running ? "running" : "ok",
      "data-expanded": expanded || void 0,
      "data-preview": preview2 || void 0,
      children: [
        running && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: accessibility_default.visuallyHidden, children: t("row.running") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          import_dsh_client_ui_primitives9.DisclosureRow,
          {
            rowClassName: ReasoningRow_default.row,
            leadingClassName: ReasoningRow_default.leading,
            titleClassName: ReasoningRow_default.title,
            chevronClassName: ReasoningRow_default.chevron,
            icon: THINK_ICON,
            title: t("message.think"),
            open: expanded,
            expandable: true,
            expandOnRowClick: true,
            onToggle: toggle,
            collapsedContent,
            children: content
          }
        )
      ]
    }
  );
});

// chat/AssistantMarkdown.module.css
var owner10 = "dsh-nexttavern-ui-chat";
var key10 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/AssistantMarkdown.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key10)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner10;
  style.dataset.pluginCss = key10;
  style.textContent = "._8ryTVW_root{font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-primary);flex-direction:column;display:flex}._8ryTVW_body{flex-direction:column;gap:16px;display:flex}._8ryTVW_body .md-table-wide{--dsh-table-spare:max(0px, calc((100cqw - var(--dsh-chat-content-width)) / 2));--dsh-table-lead:calc(var(--dsh-table-spare) + min(var(--dsh-chat-content-width), 100cqw) - 100%);box-sizing:border-box;width:calc(100% + var(--dsh-table-lead) + var(--dsh-table-spare));max-width:none;margin-left:calc(-1 * var(--dsh-table-lead));padding-left:var(--dsh-table-lead)}._8ryTVW_body .md-table-wide>table{z-index:1;position:relative}._8ryTVW_body>[data-turn-process-inline][hidden]{margin-bottom:-16px}._8ryTVW_stopped{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);border-radius:6px;align-self:flex-start;padding:0 6px;font-size:11px;line-height:18px}._8ryTVW_actions{margin-top:16px;margin-left:-6px}";
  document.head.appendChild(style);
}
var AssistantMarkdown_default = { "actions": "_8ryTVW_actions", "body": "_8ryTVW_body", "root": "_8ryTVW_root", "stopped": "_8ryTVW_stopped" };

// chat/AssistantMarkdown.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
function localPathMediaUrl(base, value) {
  if (!value.startsWith("/") || value.startsWith("//")) return void 0;
  if (!base.startsWith("http:") && !base.startsWith("https:")) return void 0;
  return new URL(`api/file?path=${encodeURIComponent(value)}`, base).href;
}
var AssistantMarkdown = (0, import_react19.memo)(function AssistantMarkdown2({
  blocks,
  streaming,
  interrupted,
  renderMessageImages,
  groupPart,
  useDisclosure: useDisclosure2,
  reasoningHidden = false,
  usePresentation,
  revealProcess,
  mentions,
  t
}) {
  const labels = (0, import_react19.useMemo)(() => markdownLabels(t), [t]);
  const pathImages = (0, import_react19.useMemo)(() => {
    return { resolve: (value) => localPathMediaUrl(document.baseURI, value) };
  }, []);
  const last = blocks.length - 1;
  const hasVisible = streaming || interrupted === true || blocks.some((block) => block.kind !== "tool-call");
  if (!hasVisible) return null;
  const rendered = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block === void 0) continue;
    if (groupPart === "reasoning" && block.kind !== "reasoning") continue;
    if (groupPart === "response" && block.kind === "reasoning") continue;
    switch (block.kind) {
      case "text":
        rendered.push(
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
            import_dsh_client_ui_primitives10.MarkdownText,
            {
              text: block.text,
              streaming,
              labels,
              fileMentions: mentions,
              pathImages
            },
            i
          )
        );
        break;
      case "reasoning":
        rendered.push(
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
            ProcessReasoning,
            {
              hidden: reasoningHidden,
              reveal: revealProcess,
              children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                ReasoningRow,
                {
                  text: block.text,
                  running: streaming && i === last,
                  usePresentation,
                  useDisclosure: useDisclosure2,
                  t
                }
              )
            },
            i
          )
        );
        break;
      case "image": {
        const start = i;
        const group = [block];
        while (i + 1 < blocks.length) {
          const next = blocks[i + 1];
          if (next === void 0 || next.kind !== "image") break;
          group.push(next);
          i += 1;
        }
        rendered.push(
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_react19.Fragment, { children: renderMessageImages({
            images: group.map(({ attachment }) => ({ attachment })),
            align: "start"
          }) }, start)
        );
        break;
      }
      // Grouped into tool rows by ChatView; hasVisible above skips an empty shell.
      case "tool-call":
        break;
      default:
        rendered.push(
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
            import_dsh_client_ui_primitives10.JsonBlock,
            {
              label: t("message.unknownBlock"),
              payload: block.block,
              truncatedLabel: (total) => t("json.truncated", { total })
            },
            i
          )
        );
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: AssistantMarkdown_default.root, "data-streaming": streaming || void 0, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: AssistantMarkdown_default.body, children: [
    rendered,
    interrupted && (groupPart === void 0 || groupPart === "response" || !blocks.some((block) => block.kind !== "reasoning" && block.kind !== "tool-call")) && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: AssistantMarkdown_default.stopped, children: t("message.stopped") })
  ] }) });
});
function ProcessReasoning({ hidden, reveal, children }) {
  const ref = useSearchableHidden(hidden, reveal ?? NOOP);
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { ref, "data-turn-process-inline": hidden || void 0, children });
}
var NOOP = () => {
};

// chat/AssistantNodeView.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
var AssistantNodeView = (0, import_react20.memo)(function AssistantNodeView2({
  node,
  groupPart,
  useDisclosure: useDisclosure2,
  useTurnData,
  turnProcess,
  openFile,
  renderMessageImages,
  fileMentions,
  usePresentation,
  t
}) {
  const data = node.data;
  const turn = node.location.kind === "turn" || node.location.kind === "step" ? node.location.turn : void 0;
  const tail = useTurnData("turn-tail");
  const owner19 = (0, import_react20.useMemo)(() => {
    if (turn?.status !== "closed" || data.finalNode === void 0) return void 0;
    if (tail?.closing?.finalNode.seq !== data.finalNode.seq) return void 0;
    return { turn, seq: data.finalNode.seq, openFile };
  }, [data.finalNode, openFile, tail, turn]);
  const mentions = (0, import_react20.useMemo)(
    () => owner19 === void 0 ? void 0 : fileMentions(owner19),
    [fileMentions, owner19]
  );
  const reasoningHidden = turnProcess !== void 0 && turnProcess.foldable && turnProcess.spec.answerStep === data.step && turnProcess.spec.inlineReasoning && !turnProcess.open;
  const revealProcess = (0, import_react20.useCallback)(() => {
    turnProcess?.setOpen(true);
  }, [turnProcess]);
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    AssistantMarkdown,
    {
      blocks: data.blocks,
      groupPart,
      useDisclosure: useDisclosure2,
      streaming: data.status === "running",
      interrupted: data.status === "interrupted",
      renderMessageImages,
      reasoningHidden,
      usePresentation,
      revealProcess,
      mentions,
      t
    }
  );
});

// chat/CommandNodeView.tsx
var import_react22 = require("react");

// chat/GenericCommandCard.tsx
var import_react21 = require("react");
var import_dsh_client_ui_primitives11 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/GenericCommandCard.module.css
var owner11 = "dsh-nexttavern-ui-chat";
var key11 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/GenericCommandCard.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key11)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner11;
  style.dataset.pluginCss = key11;
  style.textContent = ".EW0jsW_root{flex-direction:column;display:flex}.EW0jsW_leading{flex-shrink:0}.EW0jsW_chevron{color:var(--dsw-alias-label-secondary)}.EW0jsW_title{font-weight:400;transition:color .1s}.EW0jsW_separator{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.EW0jsW_summary{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:auto;transition:color .1s;overflow:hidden}.EW0jsW_row:hover .EW0jsW_title,.EW0jsW_row:hover .EW0jsW_summary:not([data-error]){color:var(--dsw-alias-label-primary)}.EW0jsW_summary[data-error],.EW0jsW_body[data-error]{color:var(--dsw-alias-state-error-primary)}.EW0jsW_body{border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-markdown-code-block);max-height:260px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-markdown-code-block-small);white-space:pre-wrap;border-radius:12px;margin:4px 0 4px 4px;padding:12px 16px;overflow:auto}";
  document.head.appendChild(style);
}
var GenericCommandCard_default = { "body": "EW0jsW_body", "chevron": "EW0jsW_chevron", "leading": "EW0jsW_leading", "root": "EW0jsW_root", "row": "EW0jsW_row", "separator": "EW0jsW_separator", "summary": "EW0jsW_summary", "title": "EW0jsW_title" };

// chat/GenericCommandCard.tsx
var import_jsx_runtime13 = require("react/jsx-runtime");
var COMMAND_ICON = /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_dsh_client_ui_primitives11.IconApiOutlineRegular, { size: 14 });
function stateOf(outcome) {
  if (outcome === null) return "running";
  return outcome.kind === "error" ? "error" : "ok";
}
var GenericCommandCard = (0, import_react21.memo)(function GenericCommandCard2({ node, t, runningSummary }) {
  const [expanded, setExpanded] = (0, import_react21.useState)(false);
  const text = node.outcome?.text;
  const summary = node.outcome === null ? runningSummary ?? t("command.running") : text ?? (node.outcome.kind === "error" ? t("command.failed") : t("command.done"));
  const title = node.name ?? t("command.title");
  const state = stateOf(node.outcome);
  const running = state === "running";
  const body = text !== void 0 && text.includes("\n") ? text : null;
  const open = expanded && body !== null;
  const toggle = (0, import_react21.useCallback)(() => {
    setExpanded((value) => !value);
  }, []);
  const collapsedContent = (0, import_react21.useMemo)(() => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: GenericCommandCard_default.separator, "aria-hidden": true }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: GenericCommandCard_default.summary, "data-error": state === "error" || void 0, children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_dsh_client_ui_primitives11.TextShimmer, { active: running, children: summary }) })
  ] }), [running, state, summary]);
  const content = (0, import_react21.useMemo)(() => open ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("pre", { className: GenericCommandCard_default.body, "data-error": state === "error" || void 0, children: body }) : void 0, [body, open, state]);
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: GenericCommandCard_default.root, "data-variant": "others", "data-state": state, children: [
    state === "running" && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: accessibility_default.visuallyHidden, children: t("row.running") }),
    state === "error" && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: accessibility_default.visuallyHidden, children: t("row.failed") }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      import_dsh_client_ui_primitives11.DisclosureRow,
      {
        rowClassName: GenericCommandCard_default.row,
        leadingClassName: GenericCommandCard_default.leading,
        titleClassName: GenericCommandCard_default.title,
        chevronClassName: GenericCommandCard_default.chevron,
        icon: COMMAND_ICON,
        title,
        running,
        open,
        expandable: body !== null,
        expandOnRowClick: true,
        keepContentWhenOpen: true,
        onToggle: toggle,
        collapsedContent,
        children: content
      }
    )
  ] });
});

// chat/CompactionCommandCard.tsx
var import_jsx_runtime14 = require("react/jsx-runtime");
function CompactionCommandCard({ node, compaction, t }) {
  if (compaction !== void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      CompactionItem,
      {
        node: compaction,
        title: t("message.compaction.commandTitle"),
        fallbackSummary: node.outcome?.text ?? null,
        t
      }
    );
  }
  if (node.outcome !== null) return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(GenericCommandCard, { node, t });
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(GenericCommandCard, { node, t, runningSummary: t("message.compaction.running") });
}

// chat/CommandNodeView.tsx
var import_jsx_runtime15 = require("react/jsx-runtime");
var CommandNodeView = (0, import_react22.memo)(function CommandNodeView2({ node, renderSlot, t }) {
  const command = node.data;
  const owner19 = (0, import_react22.useMemo)(() => ({ node: command }), [command]);
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: ChatView_default.callRow, children: renderSlot("conversation.chat.commandview", owner19, {
    entryKey: command.name ?? "",
    fallback: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(GenericCommandCard, { ...owner19, t })
  }) });
});
var ManualCompactionNodeView = (0, import_react22.memo)(function ManualCompactionNodeView2({
  node,
  t
}) {
  const data = node.data;
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: ChatView_default.callRow, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    CompactionCommandCard,
    {
      node: data.command,
      ...data.compaction === null ? {} : { compaction: data.compaction },
      t
    }
  ) });
});

// chat/SystemPromptRow.tsx
var import_react23 = require("react");
var import_dsh_client_ui_primitives12 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime16 = require("react/jsx-runtime");
function SystemPromptRow({ text, update = false, t }) {
  const [open, setOpen] = (0, import_react23.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
    import_dsh_client_ui_primitives12.DisclosureRow,
    {
      className: ContextInjectionRow_default.root,
      icon: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_dsh_client_ui_primitives12.IconBrowseOutlineRegular, { size: 14 }),
      chevronClassName: ContextInjectionRow_default.chevron,
      title: t(update ? "message.systemPromptUpdate" : "message.systemPrompt"),
      open,
      expandable: true,
      expandOnRowClick: true,
      onToggle: () => {
        setOpen((value) => !value);
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: ContextInjectionRow_default.body, "data-system-prompt-body": true, children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(OpaqueBody, { content: [{ type: "text", text }], source: null, t }) })
    }
  );
}
var SystemPromptNodeView = (0, import_react23.memo)(function SystemPromptNodeView2({
  node,
  t
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SystemPromptRow, { text: node.data.text, update: node.data.update === true, t });
});

// chat/TurnProcessNodeView.tsx
var import_react24 = require("react");
var import_dsh_client_ui_primitives13 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/TurnProcessNodeView.module.css
var owner12 = "dsh-nexttavern-ui-chat";
var key12 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/TurnProcessNodeView.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key12)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner12;
  style.dataset.pluginCss = key12;
  style.textContent = ".ftcRdG_root{box-sizing:border-box;width:100%;min-width:0;height:calc(33px + var(--dsh-content-font-delta,0px));border:none;border-bottom:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);cursor:pointer;text-align:left;background:0 0;align-items:center;padding:0 0 8px;transition:color .1s;display:flex}.ftcRdG_root:disabled{cursor:default}.ftcRdG_root:not(:disabled):hover{color:var(--dsw-alias-label-primary)}.ftcRdG_root:not([data-open]){margin-bottom:8px}.ftcRdG_chevron{width:14px;height:14px;color:var(--dsw-alias-label-caption);flex:none;margin-left:4px;transition:transform .1s}.ftcRdG_root[data-open] .ftcRdG_chevron{transform:rotate(180deg)}.ftcRdG_label{min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;overflow:hidden}@media (prefers-reduced-motion:reduce){.ftcRdG_root,.ftcRdG_chevron{transition:none}}";
  document.head.appendChild(style);
}
var TurnProcessNodeView_default = { "chevron": "ftcRdG_chevron", "label": "ftcRdG_label", "root": "ftcRdG_root" };

// chat/TurnProcessNodeView.tsx
var import_jsx_runtime17 = require("react/jsx-runtime");
var TurnProcessNodeView = (0, import_react24.memo)(function TurnProcessNodeView2({
  node,
  turnProcess,
  t
}) {
  if (turnProcess === void 0) throw new Error("turn-process node requires Turn process owner state");
  const open = turnProcess.open;
  const turn = node.location.kind === "turn" || node.location.kind === "step" ? node.location.turn : void 0;
  const [now, setNow] = (0, import_react24.useState)(Date.now);
  const ticking = turnProcess.foldable && turn?.status === "open";
  (0, import_react24.useEffect)(() => {
    if (!ticking) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, LIVE_RUN_CLOCK_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [ticking]);
  if (!turnProcess.foldable) return null;
  const canCollapse = turnProcess.hasContent && !turnProcessAlwaysOpen(node);
  const running = turn?.status === "open";
  const reason = turn?.end?.data.reason.kind;
  const elapsedMs = turn?.start === void 0 ? void 0 : Math.max(1e3, (turn.end?.time ?? now) - turn.start.time);
  const duration = elapsedMs === void 0 ? void 0 : running ? formatLiveRunDuration(elapsedMs, t) : formatRunDuration(elapsedMs, t);
  const label = running ? duration === void 0 ? t("chat.deepDiving") : t("message.turnProcess.deepDivingFor", { duration }) : reason === "aborted" ? t("message.stopped") : reason === "error" ? t("message.turnProcess.failed") : duration === void 0 ? t("message.turnProcess.worked") : t("message.turnProcess.took", { duration });
  const announcement = running ? t("chat.deepDiving") : reason === "aborted" ? t("message.stopped") : reason === "error" ? t("message.turnProcess.failed") : t("message.turnProcess.worked");
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: accessibility_default.visuallyHidden, role: "status", "aria-live": "polite", "aria-atomic": "true", children: announcement }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
      "button",
      {
        type: "button",
        className: TurnProcessNodeView_default.root,
        "data-open": open || void 0,
        "data-turn-process": node.data.turn,
        "data-turn-process-messages": node.data.messageCount,
        "data-turn-process-tool-calls": node.data.toolCallCount,
        "data-turn-process-subagents": node.data.subagentCount,
        disabled: !canCollapse,
        "aria-expanded": turnProcess.hasContent ? open : void 0,
        onClick: (event) => {
          event.currentTarget.focus();
          turnProcess.setOpen(!open);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: TurnProcessNodeView_default.label, children: label }),
          canCollapse && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_dsh_client_ui_primitives13.IconChevronDownOutlineRegular, { className: TurnProcessNodeView_default.chevron })
        ]
      }
    )
  ] });
});

// chat/TurnTailNodeView.tsx
var import_react26 = require("react");

// chat/TurnUsagePanel.tsx
var import_react_dom2 = require("react-dom");
var import_dsh_client_ui_primitives15 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/token-format.ts
function formatTokens(value, t) {
  const scaled = (candidate) => candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10);
  if (value < 1e3) return String(value);
  if (value < 1e6) return t("number.thousand", { value: scaled(value / 1e3) });
  return t("number.million", { value: scaled(value / 1e6) });
}
function formatExactTokens(value, t) {
  const digits = String(value);
  const groups = [];
  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }
  return groups.join(t("number.groupSeparator"));
}
function roundedPercentUnits(cacheReadTokens, denominator, decimalPlaces) {
  const unitsPerPercent = decimalPlaces === 0 ? 1 : 10;
  const scale = unitsPerPercent * 100;
  const doubledScale = scale * 2;
  const denominatorQuotient = Math.floor(denominator / doubledScale);
  const denominatorRemainder = denominator % doubledScale;
  let lower = 0;
  let upper = scale;
  while (lower < upper) {
    const candidate = Math.floor((lower + upper + 1) / 2);
    const factor = candidate * 2 - 1;
    const threshold = factor * denominatorQuotient + Math.ceil(factor * denominatorRemainder / doubledScale);
    if (cacheReadTokens >= threshold) lower = candidate;
    else upper = candidate - 1;
  }
  return lower;
}
function displayPercentUnits(units, decimalPlaces) {
  if (decimalPlaces === 0) return String(units);
  const whole = Math.floor(units / 10);
  const tenths = units % 10;
  return tenths === 0 ? String(whole) : `${whole}.${tenths}`;
}
function formatCacheHitPercent(cacheReadTokens, promptTokens, decimalPlaces = 0) {
  if (promptTokens === 0) return null;
  const missedInputTokens = promptTokens - cacheReadTokens;
  if (missedInputTokens === 0) return "100";
  const roundedUnits = roundedPercentUnits(cacheReadTokens, promptTokens, decimalPlaces);
  const fullHitUnits = decimalPlaces === 0 ? 100 : 1e3;
  if (roundedUnits < fullHitUnits) return displayPercentUnits(roundedUnits, decimalPlaces);
  let distinguishingPlaces = 1;
  let scaledDoubleGap = missedInputTokens * 200;
  const denominatorTens = Math.floor(promptTokens / 10);
  while (scaledDoubleGap <= denominatorTens) {
    scaledDoubleGap *= 10;
    distinguishingPlaces += 1;
  }
  const denominatorOnes = promptTokens % 10;
  let roundedLoss = 5;
  for (let loss = 1; loss < 5; loss += 1) {
    const factor = loss * 2 + 1;
    const threshold = factor * denominatorTens + Math.floor(factor * denominatorOnes / 10);
    if (scaledDoubleGap <= threshold) {
      roundedLoss = loss;
      break;
    }
  }
  return `99.${"9".repeat(distinguishingPlaces - 1)}${10 - roundedLoss}`;
}

// chat/stat-dialog.ts
var import_react25 = require("react");
var import_dsh_client_ui_primitives14 = require("@deepseek-ai/dsh-client-ui-primitives");
var PANEL_MARGIN = 12;
var PANEL_GAP = 8;
var MEASURE_STYLE = { visibility: "hidden", left: 0, top: 0 };
function useStatDialog(controlled) {
  const [ownOpen, setOwnOpen] = (0, import_react25.useState)(false);
  const open = controlled?.open ?? ownOpen;
  const setOpen = controlled?.setOpen ?? setOwnOpen;
  const rootRef = (0, import_react25.useRef)(null);
  const panelRef = (0, import_react25.useRef)(null);
  const pos = (0, import_dsh_client_ui_primitives14.useAnchoredPosition)({
    open,
    anchorRef: rootRef,
    panelRef,
    side: "top",
    gap: PANEL_GAP,
    margin: PANEL_MARGIN
  });
  (0, import_dsh_client_ui_primitives14.useDismissOnOutsidePointer)(rootRef, open, setOpen, panelRef);
  (0, import_react25.useEffect)(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, setOpen]);
  return { open, setOpen, rootRef, panelRef, pos };
}

// chat/TurnUsagePanel.module.css
var owner13 = "dsh-nexttavern-ui-chat";
var key13 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/TurnUsagePanel.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key13)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner13;
  style.dataset.pluginCss = key13;
  style.textContent = ".aOJrCW_root{min-width:0;display:inline-flex}.aOJrCW_root+.aOJrCW_root{margin-left:-6px}.aOJrCW_trigger{min-width:0;height:calc(28px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);font-variant-numeric:tabular-nums;line-height:calc(24px + var(--dsh-content-font-delta,0px));white-space:nowrap;cursor:pointer;background:0 0;border:none;border-radius:28px;align-items:center;gap:4px;padding:6px 8px;display:inline-flex}.aOJrCW_label{text-overflow:ellipsis;min-width:0;overflow:hidden}.aOJrCW_trigger svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px));flex:none}.aOJrCW_trigger:hover,.aOJrCW_trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary)}@media (width<=480px){.aOJrCW_trigger{width:calc(28px + var(--dsh-content-font-delta,0px));justify-content:center;padding:6px}.aOJrCW_trigger .aOJrCW_label{display:none}.aOJrCW_root+.aOJrCW_root{margin-left:0}}";
  document.head.appendChild(style);
}
var TurnUsagePanel_default = { "label": "aOJrCW_label", "root": "aOJrCW_root", "trigger": "aOJrCW_trigger" };

// chat/stat-dialog.module.css
var owner14 = "dsh-nexttavern-ui-chat";
var key14 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/stat-dialog.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key14)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner14;
  style.dataset.pluginCss = key14;
  style.textContent = "._9x9ZYG_panel{z-index:1100;box-sizing:border-box;background:var(--dsw-specific-menu);width:max-content;min-width:min(300px,100vw - 24px);max-width:min(440px,100vw - 24px);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;border-radius:12px;padding:16px;font-size:12px;line-height:18px;position:fixed}._9x9ZYG_title{color:var(--dsw-alias-label-primary);justify-content:space-between;gap:16px;margin-bottom:8px;font-weight:500;display:flex}._9x9ZYG_titleRule{border-top:.5px solid var(--dsw-alias-border-l2);margin-bottom:10px}._9x9ZYG_titleValue{font-variant-numeric:tabular-nums}._9x9ZYG_titleLabel{align-items:center;gap:6px;min-width:0;display:inline-flex}._9x9ZYG_titleLabel svg{flex:none;width:14px;height:14px}._9x9ZYG_details{color:var(--dsw-alias-label-tertiary);grid-template-columns:minmax(76px,auto) minmax(0,1fr);gap:6px 16px;margin:0;display:grid}._9x9ZYG_details dt,._9x9ZYG_details dd{min-width:0;margin:0}._9x9ZYG_details dd{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;text-align:right}._9x9ZYG_details ._9x9ZYG_route{overflow-wrap:anywhere}._9x9ZYG_reasoning{color:var(--dsw-alias-label-tertiary);white-space:nowrap}";
  document.head.appendChild(style);
}
var stat_dialog_default = { "details": "_9x9ZYG_details", "panel": "_9x9ZYG_panel", "reasoning": "_9x9ZYG_reasoning", "route": "_9x9ZYG_route", "title": "_9x9ZYG_title", "titleLabel": "_9x9ZYG_titleLabel", "titleRule": "_9x9ZYG_titleRule", "titleValue": "_9x9ZYG_titleValue" };

// chat/TurnUsagePanel.tsx
var import_jsx_runtime18 = require("react/jsx-runtime");
function formatCompactCount(value, t) {
  return t("message.turnUsage.count", { count: formatTokens(value, t) });
}
function formatExactCount(value, t) {
  return t("message.turnUsage.count", { count: formatExactTokens(value, t) });
}
function TurnUsagePanel({ usage, t }) {
  const { open, setOpen, rootRef, panelRef, pos } = useStatDialog();
  const cacheHit = usage.cacheReadTokens === void 0 ? null : formatCacheHitPercent(usage.cacheReadTokens, usage.totalTokens - usage.outputTokens, 1);
  const total = formatCompactCount(usage.totalTokens, t);
  const routes = usage.routes?.map((route) => `${route.provider}/${route.model}`).join(", ") ?? "";
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("span", { ref: rootRef, className: TurnUsagePanel_default.root, children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
      "button",
      {
        type: "button",
        className: TurnUsagePanel_default.trigger,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        onClick: () => {
          setOpen(!open);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_dsh_client_ui_primitives15.IconDatabaseOutlineRegular, {}),
          /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: TurnUsagePanel_default.label, children: t("message.turnUsage.consumed", { total }) })
        ]
      }
    ),
    open && (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(
        "div",
        {
          ref: panelRef,
          className: stat_dialog_default.panel,
          role: "dialog",
          "aria-label": t("message.turnUsage.title"),
          style: pos ?? MEASURE_STYLE,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: stat_dialog_default.title, children: [
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("span", { className: stat_dialog_default.titleLabel, children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_dsh_client_ui_primitives15.IconDatabaseOutlineRegular, {}),
                t("message.turnUsage.title")
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: stat_dialog_default.titleValue, children: formatExactCount(usage.totalTokens, t) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: stat_dialog_default.titleRule, "aria-hidden": true }),
            /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("dl", { className: stat_dialog_default.details, "data-turn-usage-details": true, children: [
              routes !== "" && /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dt", { children: t("message.turnUsage.model") }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dd", { className: stat_dialog_default.route, children: routes })
              ] }),
              cacheHit !== null && /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dt", { children: t("message.turnUsage.cacheHit") }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dd", { children: `${cacheHit}%` })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dt", { children: t("message.turnUsage.input") }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dd", { children: formatExactCount(usage.uncachedInputTokens, t) }),
              usage.cacheReadTokens !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dt", { children: t("message.turnUsage.cacheRead") }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dd", { children: formatExactCount(usage.cacheReadTokens, t) })
              ] }),
              usage.cacheWriteTokens !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dt", { children: t("message.turnUsage.cacheWrite") }),
                /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dd", { children: formatExactCount(usage.cacheWriteTokens, t) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("dt", { children: t("message.turnUsage.output") }),
              /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("dd", { children: [
                formatExactCount(usage.outputTokens, t),
                usage.reasoningTokens !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: stat_dialog_default.reasoning, children: t("message.turnUsage.reasoning", { tokens: formatExactCount(usage.reasoningTokens, t) }) })
              ] })
            ] })
          ]
        }
      ),
      document.body
    )
  ] });
}

// chat/turn-assistant.ts
function assistantText(blocks) {
  return blocks.flatMap((block) => block.kind === "text" ? [block.text] : []).join("");
}

// contract/assistant-content.ts
function hasAssistantReplyContent(blocks) {
  return blocks.some((block) => {
    if (block.kind === "reasoning" || block.kind === "tool-call") return false;
    if (block.kind === "text") return block.text.trim() !== "";
    return true;
  });
}

// chat/TurnTailNodeView.module.css
var owner15 = "dsh-nexttavern-ui-chat";
var key15 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/TurnTailNodeView.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key15)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner15;
  style.dataset.pluginCss = key15;
  style.textContent = "._4qSe9a_root{flex-direction:column;gap:16px;display:flex}._4qSe9a_actions{margin-top:4px;margin-left:-6px}";
  document.head.appendChild(style);
}
var TurnTailNodeView_default = { "actions": "_4qSe9a_actions", "root": "_4qSe9a_root" };

// chat/TurnTailNodeView.tsx
var import_jsx_runtime19 = require("react/jsx-runtime");
function lastContent(snapshot2, turn, skipWarning) {
  const keys = snapshot2.locations.getTurn(turn);
  for (let index = keys.length - 1; index >= 0; index--) {
    const node = snapshot2.nodes.get(keys[index]);
    if (node === void 0 || node.kind === "turn-tail" || node.kind === "turn-process" || skipWarning && node.kind === "turn-max-tokens") continue;
    return node;
  }
  return void 0;
}
var TurnTailNodeView = (0, import_react26.memo)(function TurnTailNodeView2({
  node,
  openFile,
  forkAt,
  renderSlot,
  t,
  useChat,
  usePerformanceUsage
}) {
  const detailed = usePerformanceUsage((mode) => mode) === "detailed";
  const data = node.data;
  const hasLaterChatNode = useChat((snapshot2) => (lastContent(snapshot2, data.turn, true)?.anchorSeq ?? -1) > data.seq);
  const endsWithResponse = useChat((snapshot2) => {
    if (snapshot2.timeline.turnOrder.at(-1) !== data.turn) return false;
    const last = lastContent(snapshot2, data.turn, false);
    const block = last?.kind === "assistant-step" ? last.data.blocks.findLast((candidate) => candidate.kind !== "text" && candidate.kind !== "reasoning" || candidate.text.trim() !== "") : void 0;
    return block !== void 0 && hasAssistantReplyContent([block]);
  });
  const turn = node.location.kind === "turn" || node.location.kind === "step" ? node.location.turn : void 0;
  if (turn === void 0) return null;
  const closing = data.closing;
  const owner19 = { turn, seq: closing?.presentationSeq ?? data.seq, openFile };
  const tail = renderSlot("conversation.chat.turnTail", owner19);
  if (closing === null) {
    const failed = renderSlot("conversation.chat.roleplay-failure-actions", { turn: data.turn, text: "" });
    return tail === null && failed === null ? null : /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: TurnTailNodeView_default.root, "data-turn-tail": data.turn, children: [
      tail,
      failed
    ] });
  }
  const messageId = closing.finalNode.messageId;
  const assistantActions = messageId === void 0 ? renderSlot("conversation.chat.roleplay-failure-actions", { turn: data.turn, text: assistantText(closing.blocks) }) : renderSlot("conversation.chat.assistant-actions", { messageId, turn: data.turn, text: assistantText(closing.blocks) });
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(
    "div",
    {
      className: TurnTailNodeView_default.root,
      "data-turn-tail": data.turn,
      "data-actions-reveal": endsWithResponse ? "always" : "hover",
      children: [
        tail,
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
          MessageIconActions,
          {
            text: assistantText(closing.blocks),
            time: closing.time,
            clock: "end",
            onBranch: () => {
              forkAt(data.seq);
            },
            branchUnavailable: data.branchUnavailable || hasLaterChatNode,
            className: TurnTailNodeView_default.actions,
            extraActions: assistantActions,
            usageAction: detailed && data.tokenUsage !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(TurnUsagePanel, { usage: data.tokenUsage, t }) : null,
            t
          }
        )
      ]
    }
  );
});

// chat/TurnTriggerNodeView.tsx
var import_react27 = require("react");
var import_dsh_client_ui_primitives16 = require("@deepseek-ai/dsh-client-ui-primitives");

// chat/turn-trigger.ts
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}
function field(source, key19) {
  return typeof source[key19] === "string" ? source[key19] : "";
}
function turnTriggerDetails(node) {
  const source = record(node.source);
  const kind = field(source, "kind");
  let title = "message.trigger.request";
  let icon = "request";
  switch (kind) {
    case "goal": {
      title = "message.trigger.goal";
      icon = "goal";
      break;
    }
    case "agent-message":
      title = "message.trigger.agent";
      icon = "agent";
      break;
    case "team-message":
      title = "message.trigger.team";
      icon = "team";
      break;
    case "subagent-settled": {
      title = "message.trigger.subagent";
      icon = "subagent";
      break;
    }
    case "webhook": {
      const github = field(source, "provider") === "github";
      title = github ? "message.trigger.github" : "message.trigger.webhook";
      icon = github ? "github" : "webhook";
      break;
    }
    case "schedule":
      title = "message.trigger.schedule";
      icon = "schedule";
      break;
    case "tool-jobs":
      title = "message.trigger.job";
      icon = "job";
      break;
    case "cordis-host-runner":
      title = "message.trigger.plugin";
      icon = "plugin";
      break;
    default:
      break;
  }
  return { title, icon };
}

// chat/TurnTriggerNodeView.module.css
var owner16 = "dsh-nexttavern-ui-chat";
var key16 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/TurnTriggerNodeView.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key16)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner16;
  style.dataset.pluginCss = key16;
  style.textContent = ".qRxx7q_root{border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-markdown-code-block);border-radius:16px;min-width:0;transition:background-color .1s}.qRxx7q_root:hover{background:var(--dsw-alias-interactive-bg-hover)}.qRxx7q_header{width:100%;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:10px;padding:12px 16px;display:flex}.qRxx7q_icon{color:var(--dsw-alias-label-tertiary);flex:none;display:inline-flex}.qRxx7q_title{font:var(--dsw-font-xs-13);flex:none}.qRxx7q_time{color:var(--dsw-alias-label-caption);font:var(--dsw-font-xxs-12);flex:none;margin-left:auto}.qRxx7q_chevron,.qRxx7q_openChevron{color:var(--dsw-alias-label-tertiary);flex:none}.qRxx7q_openChevron{transform:rotate(180deg)}.qRxx7q_body{padding:0 16px 12px 40px}.qRxx7q_explanation{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);margin:8px 0}.qRxx7q_content{white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;font:var(--dsw-font-xxs-12);overflow:auto}@media (prefers-reduced-motion:reduce){.qRxx7q_root{transition:none}}";
  document.head.appendChild(style);
}
var TurnTriggerNodeView_default = { "body": "qRxx7q_body", "chevron": "qRxx7q_chevron", "content": "qRxx7q_content", "explanation": "qRxx7q_explanation", "header": "qRxx7q_header", "icon": "qRxx7q_icon", "openChevron": "qRxx7q_openChevron", "root": "qRxx7q_root", "time": "qRxx7q_time", "title": "qRxx7q_title" };

// chat/TurnTriggerNodeView.tsx
var import_jsx_runtime20 = require("react/jsx-runtime");
var TRIGGER_ICONS = {
  request: import_dsh_client_ui_primitives16.IconContextInjectionOutlineRegular,
  goal: import_dsh_client_ui_primitives16.IconGoalOutlineRegular,
  agent: import_dsh_client_ui_primitives16.IconPaperPlaneOutlineRegular,
  team: import_dsh_client_ui_primitives16.IconAgentPresetOutlineRegular,
  subagent: import_dsh_client_ui_primitives16.IconAgentPresetOutlineRegular,
  github: import_dsh_client_ui_primitives16.IconBranchOutlineRegular,
  webhook: import_dsh_client_ui_primitives16.IconGlobeOutlineRegular,
  schedule: import_dsh_client_ui_primitives16.IconAlarmClockOutlineRegular,
  job: import_dsh_client_ui_primitives16.IconQueueOutlineRegular,
  plugin: import_dsh_client_ui_primitives16.IconCordisPluginOutlineRegular
};
function TurnTriggerNodeView({ node, t }) {
  const [open, setOpen] = (0, import_react27.useState)(false);
  const bodyId = (0, import_react27.useId)();
  const details = turnTriggerDetails(node.data);
  const TriggerIcon = TRIGGER_ICONS[details.icon];
  const date2 = new Date(node.data.time);
  const time = formatMessageClock(node.data.time, t);
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("section", { className: TurnTriggerNodeView_default.root, "data-turn-trigger": true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("button", { className: TurnTriggerNodeView_default.header, type: "button", "aria-expanded": open, "aria-controls": bodyId, onClick: () => {
      setOpen(!open);
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: TurnTriggerNodeView_default.icon, "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(TriggerIcon, { size: 14 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: TurnTriggerNodeView_default.title, children: t(details.title) }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("time", { className: TurnTriggerNodeView_default.time, dateTime: date2.toISOString(), children: time }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_dsh_client_ui_primitives16.IconChevronDownOutlineRegular, { size: 12, className: open ? TurnTriggerNodeView_default.openChevron : TurnTriggerNodeView_default.chevron })
    ] }),
    open && /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { id: bodyId, className: TurnTriggerNodeView_default.body, children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("p", { className: TurnTriggerNodeView_default.explanation, children: t("message.trigger.explanation") }),
      /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: TurnTriggerNodeView_default.content, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(NoticeBody, { content: node.data.content, source: node.data.source, t }) })
    ] })
  ] });
}

// chat/register-node-renderers.ts
function registerChatNodeRenderers(ctx, performanceUsage, presentation) {
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    {
      name: "conversation.chat.node",
      key: "user",
      locale: NS,
      children: { "conversation.chat.user-actions": { kind: "list", scope: "session" } }
    },
    UserMessageNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    {
      name: "conversation.chat.node",
      key: "steering",
      locale: NS
    },
    SteeringMessageNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    { name: "conversation.chat.node", key: "context", locale: NS },
    ContextMessageNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    { name: "conversation.chat.node", key: "turn-trigger", locale: NS },
    TurnTriggerNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    { name: "conversation.chat.node", key: "system-prompt", locale: NS },
    SystemPromptNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
    name: "conversation.chat.node",
    key: "assistant-step",
    locale: NS,
    inject: () => ({ hooks: { presentation } })
  }, AssistantNodeView));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
    name: "conversation.chat.node",
    key: "command",
    locale: NS,
    children: { "conversation.chat.commandview": { kind: "keyed", scope: "session" } }
  }, CommandNodeView));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    { name: "conversation.chat.node", key: "manual-compaction", locale: NS },
    ManualCompactionNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    { name: "conversation.chat.node", key: "compaction", locale: NS },
    CompactionNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    { name: "conversation.chat.node", key: "model-retry", locale: NS },
    RetryNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    { name: "conversation.chat.node", key: "turn-error", locale: NS },
    TurnErrorNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    { name: "conversation.chat.node", key: "turn-max-tokens", locale: NS },
    TurnMaxTokensNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    { name: "conversation.chat.node", key: "turn-process", locale: NS },
    TurnProcessNodeView
  ));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
    name: "conversation.chat.node",
    key: "turn-tail",
    locale: NS,
    inject: () => ({ hooks: { performanceUsage } }),
    children: {
      "conversation.chat.turnTail": { kind: "list", scope: "session" },
      "conversation.chat.assistant-actions": { kind: "list", scope: "session" },
      "conversation.chat.roleplay-failure-actions": { kind: "list", scope: "session" }
    }
  }, TurnTailNodeView));
  ctx.slots.inject("conversation.chat.node", () => ctx.slots.register(
    { name: "conversation.chat.node", key: "unknown", locale: NS },
    UnknownNodeView
  ));
}

// chat/StatsPills.tsx
var import_react28 = require("react");
var import_react_dom3 = require("react-dom");
var import_dsh_client_ui_primitives17 = require("@deepseek-ai/dsh-client-ui-primitives");

// contract/turn-metrics.ts
function usageOutputTokens(usage) {
  if (typeof usage !== "object" || usage === null) return null;
  const value = usage.outputTokens;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function assistantStepReading(node) {
  const timing = node.timing;
  const ttftMs = timing !== void 0 && timing.stepStartTime !== null && timing.firstTokenTime !== null ? Math.max(0, timing.firstTokenTime - timing.stepStartTime) : null;
  const decodeMs = timing !== void 0 && timing.firstTokenTime !== null ? Math.max(0, timing.completedTime - timing.firstTokenTime) : null;
  return { ttftMs, decodeMs, outputTokens: usageOutputTokens(node.usage) };
}

// chat/StatsPills.module.css
var owner17 = "dsh-nexttavern-ui-chat";
var key17 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/chat/StatsPills.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key17)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner17;
  style.dataset.pluginCss = key17;
  style.textContent = "._5KPcfG_root{box-sizing:border-box;min-width:0;max-width:100%;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));justify-content:center;gap:12px;display:flex}._5KPcfG_anchor{min-width:0;display:inline-flex}._5KPcfG_pill{box-sizing:border-box;max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;border-radius:24px;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}._5KPcfG_pill svg{flex:none;width:14px;height:14px}button._5KPcfG_pill{cursor:pointer}button._5KPcfG_pill:hover,button._5KPcfG_pill[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}._5KPcfG_label{text-overflow:ellipsis;min-width:0;overflow:hidden}._5KPcfG_sep{color:var(--dsw-alias-separator-primary);margin:0 6px}";
  document.head.appendChild(style);
}
var StatsPills_default = { "anchor": "_5KPcfG_anchor", "label": "_5KPcfG_label", "pill": "_5KPcfG_pill", "root": "_5KPcfG_root", "sep": "_5KPcfG_sep" };

// chat/StatsPills.tsx
var import_jsx_runtime21 = require("react/jsx-runtime");
function deriveStats(nodes) {
  const turns = /* @__PURE__ */ new Set();
  let steps = 0;
  let llmMs = 0;
  let toolMs = 0;
  let ttftMs = 0;
  let ttftSteps = 0;
  let decodeMs = 0;
  let decodeTokens = 0;
  for (const node of nodes) {
    if (node.kind === "tool-result") {
      if (node.callTime !== null) toolMs += Math.max(0, node.time - node.callTime);
      continue;
    }
    if (node.kind !== "assistant") continue;
    turns.add(node.turn);
    steps += 1;
    if (node.timing !== void 0 && node.timing.stepStartTime !== null) {
      llmMs += Math.max(0, node.timing.completedTime - node.timing.stepStartTime);
    }
    const reading = assistantStepReading(node);
    if (reading.ttftMs !== null) {
      ttftMs += reading.ttftMs;
      ttftSteps += 1;
    }
    if (reading.decodeMs !== null && reading.outputTokens !== null) {
      decodeMs += reading.decodeMs;
      decodeTokens += reading.outputTokens;
    }
  }
  return { turns: turns.size, steps, llmMs, toolMs, ttftMs, ttftSteps, decodeMs, decodeTokens };
}
function formatDuration(ms, t) {
  const s = ms / 1e3;
  if (s < 60) return t("duration.compactSeconds", { seconds: Math.round(s * 10) / 10 });
  const whole = Math.round(s);
  return t("duration.compactMinutes", {
    minutes: Math.floor(whole / 60),
    seconds: whole % 60
  });
}
function cacheHitPercent(usage) {
  const denominator = billedInputTokens(usage);
  return formatCacheHitPercent(usage.cacheReadTokens, denominator);
}
function billedInputTokens(usage) {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}
function exactCount(value, t) {
  return t("message.turnUsage.count", { count: formatExactTokens(value, t) });
}
function TimePill({ stats, t, dialog }) {
  const { open, setOpen, rootRef, panelRef, pos } = useStatDialog(dialog);
  const counts = t("stats.counts", { turns: stats.turns, steps: stats.steps });
  const tps = stats.decodeMs > 0 ? t("message.tokensPerSecond", {
    tps: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1e3))
  }) : null;
  const label = /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: StatsPills_default.label, children: [
    counts,
    tps !== null && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_jsx_runtime21.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: StatsPills_default.sep, "aria-hidden": true, children: "\xB7" }),
      tps
    ] })
  ] });
  if (stats.llmMs <= 0 && stats.toolMs <= 0 && stats.ttftSteps <= 0 && stats.decodeMs <= 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: StatsPills_default.anchor, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: StatsPills_default.pill, children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_dsh_client_ui_primitives17.IconGaugeOutlineRegular, {}),
      label
    ] }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { ref: rootRef, className: StatsPills_default.anchor, children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
      "button",
      {
        type: "button",
        className: StatsPills_default.pill,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-label": tps === null ? counts : `${counts} \xB7 ${tps}`,
        onClick: () => {
          setOpen(!open);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_dsh_client_ui_primitives17.IconGaugeOutlineRegular, {}),
          label
        ]
      }
    ),
    open && (0, import_react_dom3.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
        "div",
        {
          ref: panelRef,
          className: stat_dialog_default.panel,
          role: "dialog",
          "aria-label": t("stats.dialog.title"),
          style: pos ?? MEASURE_STYLE,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: stat_dialog_default.title, children: /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: stat_dialog_default.titleLabel, children: [
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_dsh_client_ui_primitives17.IconGaugeOutlineRegular, {}),
              t("stats.dialog.title")
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: stat_dialog_default.titleRule, "aria-hidden": true }),
            /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("dl", { className: stat_dialog_default.details, "data-session-stats-details": true, children: [
              stats.llmMs > 0 && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_jsx_runtime21.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dt", { children: t("stats.dialog.llmTime") }),
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dd", { children: formatDuration(stats.llmMs, t) })
              ] }),
              stats.toolMs > 0 && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_jsx_runtime21.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dt", { children: t("stats.dialog.toolTime") }),
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dd", { children: formatDuration(stats.toolMs, t) })
              ] }),
              stats.ttftSteps > 0 && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_jsx_runtime21.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dt", { children: t("stats.dialog.ttft") }),
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dd", { children: formatDuration(stats.ttftMs / stats.ttftSteps, t) })
              ] }),
              stats.decodeMs > 0 && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_jsx_runtime21.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dt", { children: t("stats.dialog.speed") }),
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dd", { children: t("message.tokensPerSecond", {
                  tps: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1e3))
                }) })
              ] })
            ] })
          ]
        }
      ),
      document.body
    )
  ] });
}
function UsagePill({ usage, t, dialog }) {
  const { open, setOpen, rootRef, panelRef, pos } = useStatDialog(dialog);
  const total = billedInputTokens(usage) + usage.outputTokens;
  const totalText = t("message.turnUsage.count", { count: formatTokens(total, t) });
  const cacheHit = cacheHitPercent(usage);
  const cacheHitText = cacheHit !== null ? t("stats.cacheHit", { percent: cacheHit }) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { ref: rootRef, className: StatsPills_default.anchor, children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
      "button",
      {
        type: "button",
        className: StatsPills_default.pill,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-label": cacheHitText === null ? totalText : `${totalText} \xB7 ${cacheHitText}`,
        onClick: () => {
          setOpen(!open);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_dsh_client_ui_primitives17.IconDatabaseOutlineRegular, {}),
          /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: StatsPills_default.label, children: [
            totalText,
            cacheHitText !== null && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_jsx_runtime21.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: StatsPills_default.sep, "aria-hidden": true, children: "\xB7" }),
              cacheHitText
            ] })
          ] })
        ]
      }
    ),
    open && (0, import_react_dom3.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(
        "div",
        {
          ref: panelRef,
          className: stat_dialog_default.panel,
          role: "dialog",
          "aria-label": t("stats.dialog.usageTitle"),
          style: pos ?? MEASURE_STYLE,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: stat_dialog_default.title, children: [
              /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: stat_dialog_default.titleLabel, children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_dsh_client_ui_primitives17.IconDatabaseOutlineRegular, {}),
                t("stats.dialog.usageTitle")
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("span", { className: stat_dialog_default.titleValue, children: exactCount(total, t) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: stat_dialog_default.titleRule, "aria-hidden": true }),
            /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("dl", { className: stat_dialog_default.details, "data-session-stats-usage": true, children: [
              cacheHit !== null && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_jsx_runtime21.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dt", { children: t("message.turnUsage.cacheHit") }),
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dd", { children: `${cacheHit}%` })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dt", { children: t("message.turnUsage.input") }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dd", { children: exactCount(usage.uncachedInputTokens, t) }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dt", { children: t("message.turnUsage.cacheRead") }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dd", { children: exactCount(usage.cacheReadTokens, t) }),
              usage.cacheWriteTokens !== 0 && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_jsx_runtime21.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dt", { children: t("message.turnUsage.cacheWrite") }),
                /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dd", { children: exactCount(usage.cacheWriteTokens, t) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dt", { children: t("message.turnUsage.output") }),
              /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("dd", { children: exactCount(usage.outputTokens, t) })
            ] })
          ]
        }
      ),
      document.body
    )
  ] });
}
var StatsPills = (0, import_react28.memo)(function StatsPills2({ useChat, useProjection, usePerformanceUsage, t }) {
  const mode = usePerformanceUsage((value) => value);
  const settledNodes = useChat((s) => s.legacy.nodes);
  const usage = useProjection("tokenUsage");
  const [openPill, setOpenPill] = (0, import_react28.useState)(null);
  const projected = useProjection("sessionStats");
  const stats = (0, import_react28.useMemo)(() => projected ?? deriveStats(settledNodes), [projected, settledNodes]);
  const hasTokens = usage !== void 0 && (billedInputTokens(usage) > 0 || usage.outputTokens > 0);
  if (mode === "compact") {
    const speed = stats.decodeMs > 0 ? t("message.tokensPerSecond", { tps: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1e3)) }) : null;
    const cacheHit = hasTokens ? cacheHitPercent(usage) : null;
    if (speed === null && cacheHit === null) return null;
    return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: StatsPills_default.root, "data-composer-stats": true, children: [
      speed !== null && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: StatsPills_default.pill, children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_dsh_client_ui_primitives17.IconGaugeOutlineRegular, {}),
        speed
      ] }),
      cacheHit !== null && /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("span", { className: StatsPills_default.pill, children: [
        /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_dsh_client_ui_primitives17.IconDatabaseOutlineRegular, {}),
        t("stats.cacheHit", { percent: cacheHit })
      ] })
    ] });
  }
  if (stats.steps === 0 && !hasTokens) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: StatsPills_default.root, "data-composer-stats": true, children: [
    stats.steps > 0 && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
      TimePill,
      {
        stats,
        t,
        dialog: {
          open: openPill === "time",
          setOpen: (open) => {
            setOpenPill(open ? "time" : null);
          }
        }
      }
    ),
    hasTokens && /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
      UsagePill,
      {
        usage,
        t,
        dialog: {
          open: openPill === "usage",
          setOpen: (open) => {
            setOpenPill(open ? "usage" : null);
          }
        }
      }
    )
  ] });
});

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-session/lib/types/surface.js
var SURFACE_EVENT_TYPES = /* @__PURE__ */ new Set([
  "system/message",
  "developer/message",
  "user/message",
  "assistant/message",
  "tool/result"
]);
function isSurfaceEvent(event) {
  if (!SURFACE_EVENT_TYPES.has(event.type))
    return false;
  const candidate = event;
  return candidate.surfaceOp !== void 0;
}
function isAppendSurfaceEvent(event) {
  return isSurfaceEvent(event) && event.surfaceOp === "append";
}
function isReplacementSurfaceEvent(event) {
  return isSurfaceEvent(event) && event.surfaceOp !== "append";
}

// conversation-nodes/common.ts
var CHAT_SYNTHETIC_SEQ_OFFSETS = {
  interruptedAssistant: -0.9,
  interruptedFollowup: -0.8,
  processControl: -0.1,
  maxTokensNotice: 0.05,
  finalizedFollowup: 0.1
};
function contextLocation(context) {
  return context.start?.location ?? context.matches[0]?.location ?? { kind: "unresolved" };
}
function chatNode(context, kind, anchorSeq, data, options = {}) {
  return {
    key: context.key,
    kind,
    id: context.id,
    target: "chat",
    anchorSeq,
    location: options.location ?? contextLocation(context),
    visibility: options.visibility ?? "visible",
    data
  };
}

// conversation-nodes/event-projection.ts
function asRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function readString(record2, key19) {
  const value = record2[key19];
  return typeof value === "string" && value.length > 0 ? value : null;
}
function collect(source, member, field2) {
  const list = source[member];
  if (!Array.isArray(list)) return [];
  const seen = [];
  for (const entry of list) {
    const record2 = asRecord2(entry);
    const value = record2 === null ? null : readString(record2, field2);
    if (value !== null && !seen.includes(value)) seen.push(value);
  }
  return seen;
}
function joined(names) {
  return names.length > 0 ? names.join(", ") : null;
}
var KNOWN_FORMS = [
  "instructions",
  "catalog",
  "snapshot",
  "notice",
  "relay",
  "recall"
];
function contextForm(source) {
  const record2 = asRecord2(source);
  const form = record2 === null ? null : readString(record2, "form");
  return form !== null && KNOWN_FORMS.includes(form) ? form : null;
}
function contextProducer(source) {
  const record2 = asRecord2(source);
  const kind = record2 === null ? null : readString(record2, "kind");
  if (record2 === null || kind === null) return { role: "inject", label: null };
  switch (kind) {
    case "session-reference":
      return { role: "recall", label: joined(collect(record2, "references", "label")) ?? kind };
    case "agent-instructions":
      return { role: "inject", label: joined(collect(record2, "changes", "path")) ?? kind };
    case "skill-invocation":
      return { role: "inject", label: readString(record2, "name") ?? kind };
    default:
      return { role: "inject", label: kind };
  }
}
function sessionRecallLabels(source) {
  const record2 = asRecord2(source);
  if (record2 === null || readString(record2, "kind") !== "session-reference") return [];
  return collect(record2, "references", "label");
}
function skillInvocationName(source) {
  const record2 = asRecord2(source);
  if (record2 === null || readString(record2, "kind") !== "skill-invocation") return null;
  return readString(record2, "name");
}
function toAssistantBlocks(content) {
  return content.map(toAssistantBlock);
}
function toAssistantBlock(block) {
  switch (block.type) {
    case "text":
      return { kind: "text", text: block.text };
    case "reasoning":
      return { kind: "reasoning", text: block.text };
    case "image":
      return { kind: "image", attachment: block.attachment };
    case "tool-call":
      return { kind: "tool-call", callId: String(block.id), name: block.name, argsRaw: block.arguments };
    default:
      return { kind: "other", block };
  }
}
function emptyAssistantBlock(blockType) {
  switch (blockType) {
    case "text":
      return { kind: "text", text: "" };
    case "reasoning":
      return { kind: "reasoning", text: "" };
    case "tool-call":
      return { kind: "tool-call", callId: "", name: "", argsRaw: "" };
    default:
      return { kind: "other", block: null };
  }
}
function displayFailure(failure) {
  if (failure === null || typeof failure !== "object") return { message: String(failure) };
  const record2 = failure;
  const code = typeof record2.code === "string" ? record2.code : void 0;
  if (code === "AUTH") return { code, message: "" };
  return {
    ...code === void 0 ? {} : { code },
    message: typeof record2.message === "string" ? record2.message : JSON.stringify(failure)
  };
}
function isTokenDelta(chunk) {
  switch (chunk.type) {
    case "text-delta":
    case "reasoning-delta":
      return chunk.text !== "";
    case "tool-call-delta":
      return chunk.argumentsDelta !== "" || chunk.name !== void 0;
    default:
      return false;
  }
}

// conversation-nodes/assistant.ts
function initialState(turn, step) {
  return {
    turn,
    step,
    blocks: [],
    visibleBlocks: 0,
    firstVisibleSeq: void 0,
    firstVisibleTime: void 0,
    firstTokenTime: void 0,
    final: void 0,
    usage: void 0
  };
}
function compactBlocks(blocks) {
  return blocks.filter((block) => block !== void 0);
}
function blockIsVisible(block) {
  if (block === void 0 || block.kind === "tool-call") return false;
  if (block.kind === "text" || block.kind === "reasoning") return block.text.trim() !== "";
  return true;
}
function countVisibleBlocks(blocks) {
  let count = 0;
  for (const block of blocks) if (blockIsVisible(block)) count++;
  return count;
}
function hasVisibleContent(blocks) {
  return blocks.some(blockIsVisible);
}
function hasInterruptionEvidence(blocks) {
  return blocks.some((block) => {
    if (block.kind === "text" || block.kind === "reasoning") return block.text.trim() !== "";
    return true;
  });
}
function resetForRetry(state) {
  return {
    ...initialState(state.turn, state.step),
    firstTokenTime: state.firstTokenTime
  };
}
function updateChunk(state, chunk, seq, time) {
  const blocks = [...state.blocks];
  let changedIndex = -1;
  let previousVisible = false;
  switch (chunk.type) {
    case "block-start":
      changedIndex = chunk.index;
      previousVisible = blockIsVisible(blocks[chunk.index]);
      blocks[chunk.index] = emptyAssistantBlock(chunk.blockType);
      break;
    case "text-delta": {
      const previous = blocks[chunk.index];
      changedIndex = chunk.index;
      previousVisible = blockIsVisible(previous);
      blocks[chunk.index] = { kind: "text", text: (previous?.kind === "text" ? previous.text : "") + chunk.text };
      break;
    }
    case "reasoning-delta": {
      const previous = blocks[chunk.index];
      changedIndex = chunk.index;
      previousVisible = blockIsVisible(previous);
      blocks[chunk.index] = { kind: "reasoning", text: (previous?.kind === "reasoning" ? previous.text : "") + chunk.text };
      break;
    }
    case "tool-call-delta": {
      const previous = blocks[chunk.index];
      changedIndex = chunk.index;
      previousVisible = blockIsVisible(previous);
      const base = previous?.kind === "tool-call" ? previous : { kind: "tool-call", callId: "", name: "", argsRaw: "" };
      blocks[chunk.index] = {
        kind: "tool-call",
        callId: base.callId || String(chunk.id),
        name: chunk.name ?? base.name,
        argsRaw: base.argsRaw + chunk.argumentsDelta
      };
      break;
    }
    case "block-end":
      changedIndex = chunk.index;
      previousVisible = blockIsVisible(blocks[chunk.index]);
      blocks[chunk.index] = toAssistantBlock(chunk.block);
      break;
    case "usage":
      return { ...state, usage: chunk.usage };
    default:
      return state;
  }
  const visibleBlocks = state.visibleBlocks - Number(previousVisible) + Number(blockIsVisible(blocks[changedIndex]));
  const firstToken = isTokenDelta(chunk);
  return {
    ...state,
    blocks,
    visibleBlocks,
    ...visibleBlocks > 0 && state.firstVisibleSeq === void 0 ? { firstVisibleSeq: seq, firstVisibleTime: time } : {},
    ...firstToken && state.firstTokenTime === void 0 ? { firstTokenTime: time } : {}
  };
}
function settleMessage(state, match, event) {
  if (!isAppendSurfaceEvent(event)) return state;
  const blocks = toAssistantBlocks(event.data.message.content);
  return {
    ...state,
    blocks,
    visibleBlocks: countVisibleBlocks(blocks),
    final: match,
    usage: event.data.usage
  };
}
function closedBoundary(location) {
  if (location.kind === "step" && location.step.status === "closed" && location.step.end !== void 0) {
    return location.step.end;
  }
  if ((location.kind === "step" || location.kind === "turn") && location.turn.status === "closed" && location.turn.end !== void 0) {
    return location.turn.end;
  }
  return void 0;
}
function finalNode(state, context) {
  const final = state.final;
  if (final?.event.type === "assistant/message") {
    const event = final.event;
    return {
      kind: "assistant",
      seq: event.seq,
      messageId: event.data.message.id,
      time: event.time,
      turn: state.turn,
      step: state.step,
      blocks: toAssistantBlocks(event.data.message.content),
      usage: event.data.usage,
      timing: {
        stepStartTime: context.start?.event.time ?? null,
        firstTokenTime: state.firstTokenTime ?? null,
        completedTime: event.time
      },
      ...event.data.interrupted === true ? { interrupted: true } : {}
    };
  }
  const location = context.start?.location ?? context.matches.at(-1)?.location;
  const boundary = location === void 0 ? void 0 : closedBoundary(location);
  if (boundary === void 0) return void 0;
  const blocks = compactBlocks(state.blocks);
  if (!hasInterruptionEvidence(blocks)) return void 0;
  return {
    kind: "assistant",
    seq: boundary.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.interruptedAssistant,
    time: boundary.time,
    turn: state.turn,
    step: state.step,
    blocks,
    interrupted: true
  };
}
function fallbackState(context) {
  let state;
  for (const match of context.matches) {
    if (match.event.type === "assistant/live-chunk") {
      state ??= initialState(match.event.data.turn, match.event.data.step);
      state = updateChunk(state, match.event.data.chunk, match.event.seq, match.event.time);
      continue;
    }
    if (match.event.type === "assistant/message") {
      state ??= initialState(match.event.data.turn, match.event.data.step);
      state = settleMessage(state, match, match.event);
      continue;
    }
    if (match.event.type === "llm/retry" && state !== void 0) {
      state = resetForRetry(state);
    }
  }
  return state;
}
function projectAssistant(context) {
  const state = context.state ?? fallbackState(context);
  if (state === void 0) return void 0;
  const settled = finalNode(state, context);
  const blocks = settled?.blocks ?? compactBlocks(state.blocks);
  const visible = settled === void 0 ? state.visibleBlocks > 0 : hasVisibleContent(blocks);
  const status = settled?.interrupted === true ? "interrupted" : settled === void 0 ? "running" : "settled";
  const anchorSeq = state.firstVisibleSeq ?? settled?.seq ?? context.matches[0]?.event.seq ?? 0;
  const time = state.firstVisibleTime ?? settled?.time ?? context.matches[0]?.event.time ?? 0;
  return {
    anchorSeq,
    visible,
    settled,
    data: {
      status,
      turn: state.turn,
      step: state.step,
      blocks,
      time,
      presentationSeq: anchorSeq,
      ...state.usage === void 0 ? {} : { usage: state.usage },
      ...settled === void 0 ? {} : { finalNode: settled }
    }
  };
}
function publishedAssistantData(context) {
  const location = context.start?.location ?? context.matches.at(-1)?.location;
  return location?.kind === "step" ? location.step.data.get("assistant-step") : void 0;
}
var assistantDefinition = {
  kind: "assistant-step",
  target: "chat",
  match: (event) => {
    if (event.type === "step/start") return { id: `${event.data.turn}:${event.data.step}`, role: "start" };
    if (event.type === "assistant/live-chunk" || event.type === "assistant/message" && isAppendSurfaceEvent(event)) {
      return { id: `${event.data.turn}:${event.data.step}`, role: "update" };
    }
    if (event.type === "llm/retry") {
      return { id: `${event.data.turn}:${event.data.step}`, role: "update" };
    }
    return null;
  },
  start: (_context, match) => {
    if (match.event.type !== "step/start") throw new Error("assistant-step start requires step/start");
    return initialState(match.event.data.turn, match.event.data.step);
  },
  update: (context, match) => {
    if (match.event.type === "assistant/live-chunk") {
      return updateChunk(context.state, match.event.data.chunk, match.event.seq, match.event.time);
    }
    if (match.event.type === "assistant/message") return settleMessage(context.state, match, match.event);
    if (match.event.type === "llm/retry") {
      return resetForRetry(context.state);
    }
    return context.state;
  },
  publication: (match) => {
    if (match.event.type === "step/start") return "none";
    if (match.event.type !== "assistant/live-chunk") return "immediate";
    const type = match.event.data.chunk.type;
    return type === "usage" || type === "finish" ? "none" : "animation-frame";
  },
  buildLocationData: (context, scope) => {
    if (scope !== "step") return null;
    const projected = projectAssistant(context);
    if (projected === void 0) return null;
    return {
      kind: "step",
      turn: projected.data.turn,
      step: projected.data.step,
      key: "assistant-step",
      value: projected.data
    };
  },
  buildViewNode: (context) => {
    const current = context.current.get("chat");
    const state = context.state ?? fallbackState(context);
    const data = publishedAssistantData(context);
    if (state === void 0 || data === void 0) {
      return current == null ? null : { ...current, visibility: "hidden" };
    }
    const settled = data.finalNode;
    const visible = settled === void 0 ? state.visibleBlocks > 0 : hasVisibleContent(data.blocks);
    if (settled === void 0 && !visible && current == null) return null;
    const anchorSeq = data.presentationSeq;
    return chatNode(context, "assistant-step", anchorSeq, data, {
      visibility: settled?.interrupted === true || visible ? "visible" : "hidden"
    });
  }
};
function registerAssistantConversationNode(ctx) {
  ctx.uiConversation.events.register(assistantDefinition);
}

// conversation-nodes/chat-snapshot-builder.ts
var import_dsh_client_store3 = require("@deepseek-ai/dsh-client-store");

// contract/chat-nodes.ts
function isSettledTool(block) {
  return "kind" in block;
}
function isRunningTool(block) {
  return !isSettledTool(block);
}

// contract/chat-visibility.ts
function isVisibleChatNode(node) {
  return node.visibility === "visible" && node.kind !== "system-prompt" && node.kind !== "context" && !(node.kind === "command" && node.data.name === "permission");
}

// conversation-nodes/turn-navigation.ts
var PROMPT_PREVIEW_LIMIT = 50;
var RESPONSE_PREVIEW_LIMIT = 120;
function preview(parts, limit) {
  let text = "";
  let unread = false;
  for (const part of parts) {
    if (text.length >= limit * 2) {
      unread = true;
      break;
    }
    const clipped = part.length > limit * 2;
    const chunk = clipped ? part.slice(0, limit * 2) : part;
    text += text === "" ? chunk : ` ${chunk}`;
    if (clipped) {
      unread = true;
      break;
    }
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length > limit - 1) return `${normalized.slice(0, limit - 1).trimEnd()}\u2026`;
  return unread ? `${normalized}\u2026` : normalized;
}
function promptText(node) {
  if (node.kind !== "user") return "";
  return preview(node.data.content.flatMap((block) => block.type === "text" ? [block.text] : []), PROMPT_PREVIEW_LIMIT);
}
function responseText(node) {
  if (node.kind !== "assistant-step") return "";
  return preview(
    node.data.blocks.flatMap((block) => block.kind === "text" ? [block.text] : []),
    RESPONSE_PREVIEW_LIMIT
  );
}
function sameTurnNavigationItem(left, right) {
  if (left === void 0 || right === void 0) return left === right;
  return left.turn === right.turn && left.anchorKey === right.anchorKey && left.prompt === right.prompt && left.response === right.response;
}
function turnNavigationItem(turn, locations, nodes) {
  const loaded = locations.getTurn(turn).map((key19) => nodes.get(key19)).filter((node) => node !== void 0 && isVisibleChatNode(node));
  const user = loaded.find((node) => node.kind === "user");
  const anchor = user ?? loaded[0];
  if (anchor === void 0) return void 0;
  const response = loaded.findLast((node) => responseText(node) !== "");
  return {
    turn,
    anchorKey: anchor.key,
    prompt: user === void 0 ? "" : promptText(user),
    response: response === void 0 ? "" : responseText(response)
  };
}

// conversation-nodes/turn-process-presentation.ts
function nodeTurn(node) {
  const location = node?.location;
  return location?.kind === "turn" || location?.kind === "step" ? location.turn.turn : void 0;
}
function samePresentation(left, right) {
  return left === right || left !== void 0 && right !== void 0 && left.spec === right.spec && left.turn === right.turn && left.turnStarted === right.turnStarted && left.turnClosed === right.turnClosed && left.hasExternalProcess === right.hasExternalProcess && left.hasInterleavedInput === right.hasInterleavedInput && left.compactAnswer === right.compactAnswer;
}
function derivePresentation(turn, locations, nodes) {
  const keys = locations.getTurn(turn);
  const control = keys.map((key19) => nodes.get(key19)).find((node) => node?.kind === "turn-process");
  if (control === void 0) return void 0;
  const spec = control.data;
  const location = control.location;
  if (location.kind !== "turn" && location.kind !== "step") return void 0;
  let openingHumanAnchor;
  for (const key19 of keys) {
    const node = nodes.get(key19);
    if ((node?.kind === "user" || node?.kind === "steering" || node?.kind === "turn-trigger") && (spec.controlAnchorSeq === location.turn.start?.seq || node.anchorSeq < spec.controlAnchorSeq)) {
      openingHumanAnchor = Math.max(openingHumanAnchor ?? node.anchorSeq, node.anchorSeq);
    }
  }
  let hasExternalProcess = false;
  let hasInterleavedInput = false;
  let compactAnswer = true;
  for (const key19 of keys) {
    const node = nodes.get(key19);
    if (node === void 0 || !isVisibleChatNode(node) || node.kind === "turn-process") continue;
    if ((node.kind === "user" || node.kind === "steering" || node.kind === "turn-trigger") && (openingHumanAnchor === void 0 || node.anchorSeq > openingHumanAnchor)) {
      hasInterleavedInput = true;
      if (spec.answerAnchorSeq === null || node.anchorSeq < spec.answerAnchorSeq) compactAnswer = false;
    }
    if (!turnProcessMember(node, spec)) continue;
    if (node.kind !== "assistant-step" || spec.answerStep === null || node.data.step !== spec.answerStep) {
      hasExternalProcess = true;
    }
  }
  return {
    turn,
    spec,
    turnStarted: location.turn.start !== void 0,
    turnClosed: location.turn.status === "closed",
    hasExternalProcess,
    hasInterleavedInput,
    compactAnswer
  };
}
var ChatTurnProcessProjector = class {
  presentations = /* @__PURE__ */ new Map();
  /**
   * Read the retained process presentation for a Node's Turn.
   * @param node - Current Chat Node.
   * @returns The Turn's process presentation, when present.
   */
  get(node) {
    const turn = nodeTurn(node);
    return turn === void 0 ? void 0 : this.presentations.get(turn);
  }
  /**
   * Replace every projected Turn.
   * @param order - visible Chat Node order.
   * @param locations - current Chat Location index.
   * @param nodes - current Chat Node store.
   * @returns Turns whose process presentation changed.
   */
  replace(order, locations, nodes) {
    const turns = /* @__PURE__ */ new Set();
    for (const key19 of order) {
      const turn = nodeTurn(nodes.get(key19));
      if (turn !== void 0) turns.add(turn);
    }
    const changed = /* @__PURE__ */ new Set();
    for (const turn of /* @__PURE__ */ new Set([...this.presentations.keys(), ...turns])) {
      if (this.set(turn, turns.has(turn) ? derivePresentation(turn, locations, nodes) : void 0)) {
        changed.add(turn);
      }
    }
    return changed;
  }
  /**
   * Recompute selected Turns after incremental Node changes.
   * @param turns - affected Turn numbers.
   * @param locations - current Chat Location index.
   * @param nodes - current Chat Node store.
   * @returns Turns whose process presentation changed.
   */
  update(turns, locations, nodes) {
    const changed = /* @__PURE__ */ new Set();
    for (const turn of turns) {
      if (this.set(turn, derivePresentation(turn, locations, nodes))) changed.add(turn);
    }
    return changed;
  }
  set(turn, next) {
    const current = this.presentations.get(turn);
    if (samePresentation(current, next)) return false;
    if (next === void 0) this.presentations.delete(turn);
    else this.presentations.set(turn, next);
    return true;
  }
};

// ../../../session-format/lib/projection.js
function assertMessageEdit(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw Error("Invalid message edit payload");
  const data = value;
  if (Object.keys(data).sort().join(",") !== "messageId,role,schemaVersion,targetSeq,text" || data.schemaVersion !== 1 || !Number.isSafeInteger(data.targetSeq) || Number(data.targetSeq) < 0 || Object.is(data.targetSeq, -0) || typeof data.messageId !== "string" || data.messageId.length === 0 || data.role !== "assistant" && data.role !== "user" || typeof data.text !== "string" || data.text.length > 1e6)
    throw Error("Unsupported or malformed message edit v1");
}

// conversation-nodes/message-edits.ts
var messageEditDefinition = {
  kind: "roleplay-message-edit",
  target: "chat",
  // Update-only contexts also work when the first edit precedes the loaded
  // window. They need no synthetic start event or target-message mutation.
  match: (event) => event.type === "roleplay/message-edit" ? { id: String(event.data.targetSeq), role: "update" } : null,
  start: () => void 0,
  update: () => void 0,
  buildViewNode(context) {
    const event = context.matches.at(-1)?.event;
    if (event?.type !== "roleplay/message-edit") return null;
    assertMessageEdit(event.data);
    if (event.ignorable || event.data.targetSeq >= event.seq) throw Error("Invalid required chat message edit");
    return chatNode(
      context,
      "message-edit",
      event.data.targetSeq,
      { ...event.data, editSeq: event.seq },
      { visibility: "hidden", location: { kind: "session" } }
    );
  }
};
function userContent(content, text) {
  let inserted = false;
  const result = [];
  for (const block of content) {
    if (block.type !== "text") result.push(block);
    else if (!inserted) {
      result.push({ type: "text", text });
      inserted = true;
    }
  }
  if (!inserted) result.unshift({ type: "text", text });
  return result;
}
function assistantContent(content, text) {
  let inserted = false;
  const result = [];
  for (const block of content) {
    if (block.kind !== "text") result.push(block);
    else if (!inserted) {
      result.push({ kind: "text", text });
      inserted = true;
    }
  }
  if (!inserted) result.unshift({ kind: "text", text });
  return result;
}
function editedAssistant(data, edit) {
  if (edit.role !== "assistant" || data.finalNode.messageId !== edit.messageId) throw Error("Chat assistant edit identity mismatch");
  const blocks = assistantContent(data.blocks, edit.text);
  return { ...data, blocks, finalNode: { ...data.finalNode, blocks } };
}
function targetSeq(raw) {
  const node = raw;
  if (node.kind === "user" || node.kind === "steering") return node.data.seq;
  if (node.kind === "assistant-step") return node.data.finalNode?.seq;
  if (node.kind === "turn-tail") return node.data.closing?.finalNode.seq;
  return void 0;
}
function project(raw, edit) {
  if (edit === void 0) return raw;
  const node = raw;
  if (node.kind === "user" || node.kind === "steering") {
    if (edit.role !== "user" || node.data.messageId !== edit.messageId) throw Error("Chat user edit identity mismatch");
    return { ...node, data: { ...node.data, content: userContent(node.data.content, edit.text) } };
  }
  if (node.kind === "assistant-step" && node.data.finalNode !== void 0) {
    const data = editedAssistant(node.data, edit);
    const visible = data.blocks.some((block) => block.kind !== "tool-call" && (block.kind !== "text" && block.kind !== "reasoning" || block.text.trim() !== ""));
    return { ...node, data, visibility: visible ? "visible" : "hidden" };
  }
  if (node.kind === "turn-tail" && node.data.closing !== null) {
    return { ...node, data: { ...node.data, closing: editedAssistant(node.data.closing, edit) } };
  }
  return raw;
}
var ChatMessageEditProjector = class {
  edits = /* @__PURE__ */ new Map();
  raw = /* @__PURE__ */ new Map();
  keysByTarget = /* @__PURE__ */ new Map();
  targetByKey = /* @__PURE__ */ new Map();
  replace(nodes) {
    this.raw.clear();
    this.keysByTarget.clear();
    this.targetByKey.clear();
    return this.apply(nodes);
  }
  apply(nodes) {
    const dirty = /* @__PURE__ */ new Set();
    const changedTargets = /* @__PURE__ */ new Set();
    for (const raw of nodes) {
      const node = raw;
      if (node.kind === "message-edit") {
        const previous = this.edits.get(node.data.targetSeq);
        if (previous === void 0 || previous.editSeq < node.data.editSeq) {
          this.edits.set(node.data.targetSeq, node.data);
          changedTargets.add(node.data.targetSeq);
        }
        continue;
      }
      this.raw.set(node.key, raw);
      dirty.add(node.key);
      const oldTarget = this.targetByKey.get(node.key);
      const target = targetSeq(raw);
      if (oldTarget !== target && oldTarget !== void 0) {
        const keys = this.keysByTarget.get(oldTarget);
        keys?.delete(node.key);
        if (!keys?.size) this.keysByTarget.delete(oldTarget);
        this.targetByKey.delete(node.key);
      }
      if (target !== void 0) {
        this.targetByKey.set(node.key, target);
        let keys = this.keysByTarget.get(target);
        if (keys === void 0) this.keysByTarget.set(target, keys = /* @__PURE__ */ new Set());
        keys.add(node.key);
      }
    }
    for (const target of changedTargets) for (const key19 of this.keysByTarget.get(target) ?? []) dirty.add(key19);
    return [...dirty].map((key19) => {
      const raw = this.raw.get(key19);
      const target = this.targetByKey.get(key19);
      return project(raw, target === void 0 ? void 0 : this.edits.get(target));
    });
  }
};
function registerMessageEdits(ctx) {
  ctx.uiConversation.events.register(messageEditDefinition);
}

// conversation-nodes/chat-snapshot-builder.ts
var EMPTY_KEYS = [];
var EMPTY_TURNS = [];
var EMPTY_ITEMS2 = [];
var EMPTY_LIST2 = [];
function sameReferences(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function cachedSource(sources, key19, create) {
  let source = sources.get(key19);
  if (source === void 0) {
    source = create();
    sources.set(key19, source);
  }
  return source;
}
var MutableChatSource = class {
  constructor(read, label) {
    this.read = read;
    this.label = label;
    this.published = read();
  }
  listeners = /* @__PURE__ */ new Set();
  published;
  getSnapshot = () => this.read();
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  publish() {
    const next = this.getSnapshot();
    if (this.published === next) return;
    this.published = next;
    (0, import_dsh_client_store3.notifySubscribers)(this.listeners, this.label);
  }
};
var TurnKindNodes = class {
  nodes = /* @__PURE__ */ new Map();
  current = EMPTY_LIST2;
  dirty = false;
  observable;
  source() {
    return this.observable ??= new MutableChatSource(() => this.read(), "[ui-chat] turn kind nodes");
  }
  set(node) {
    const previous = this.nodes.get(node.key);
    this.nodes.set(node.key, node);
    if (previous !== void 0 && previous.data === node.data && previous.anchorSeq === node.anchorSeq) return;
    this.dirty = true;
  }
  delete(key19) {
    this.nodes.delete(key19);
    this.dirty = true;
  }
  publish() {
    this.observable?.publish();
  }
  read() {
    if (this.dirty) {
      this.current = [...this.nodes.values()].sort((a, b) => a.anchorSeq - b.anchorSeq).map((node) => node.data);
      this.dirty = false;
    }
    return this.current;
  }
};
var MutableChatNodeStore = class {
  byKey = /* @__PURE__ */ new Map();
  turnProcesses = new ChatTurnProcessProjector();
  sources = /* @__PURE__ */ new Map();
  processSources = /* @__PURE__ */ new Map();
  dirtyKeys = /* @__PURE__ */ new Set();
  dirtyProcessKeys = /* @__PURE__ */ new Set();
  turnKinds = /* @__PURE__ */ new Map();
  dirtyTurnKinds = /* @__PURE__ */ new Set();
  valuesCache = EMPTY_LIST2;
  valuesDirty = false;
  get(key19) {
    return this.byKey.get(key19);
  }
  source(key19) {
    return cachedSource(this.sources, key19, () => new MutableChatSource(
      () => this.get(key19),
      `[ui-chat] node source ${key19}`
    ));
  }
  turnDataSource(turn, kind) {
    return this.turnKind(turn, kind).source();
  }
  turnKind(turn, kind) {
    const kinds = cachedSource(this.turnKinds, turn, () => /* @__PURE__ */ new Map());
    return cachedSource(kinds, kind, () => new TurnKindNodes());
  }
  updateTurnKind(previous, next) {
    const before = previous === void 0 ? void 0 : locationCoordinates(previous.location).turn;
    const after = next === void 0 ? void 0 : locationCoordinates(next.location).turn;
    if (previous !== void 0 && before !== void 0 && (before !== after || previous.kind !== next?.kind)) {
      const collection = this.turnKind(before, previous.kind);
      collection.delete(previous.key);
      this.dirtyTurnKinds.add(collection);
    }
    if (next !== void 0 && after !== void 0) {
      const collection = this.turnKind(after, next.kind);
      collection.set(next);
      this.dirtyTurnKinds.add(collection);
    }
  }
  processSource(key19) {
    return cachedSource(this.processSources, key19, () => new MutableChatSource(
      () => this.process(key19),
      `[ui-chat] node process source ${key19}`
    ));
  }
  process(key19) {
    return this.turnProcesses.get(this.get(key19));
  }
  values() {
    if (this.valuesDirty) {
      this.valuesCache = [...this.byKey.values()];
      this.valuesDirty = false;
    }
    return this.valuesCache;
  }
  replace(nodes) {
    const previous = new Map(this.byKey);
    this.byKey.clear();
    for (const node of nodes) {
      this.byKey.set(node.key, node);
      if (previous.get(node.key) !== node) {
        this.updateTurnKind(previous.get(node.key), node);
        this.dirtyKeys.add(node.key);
        this.dirtyProcessKeys.add(node.key);
      }
      previous.delete(node.key);
    }
    for (const key19 of previous.keys()) {
      this.updateTurnKind(previous.get(key19), void 0);
      this.dirtyKeys.add(key19);
      this.dirtyProcessKeys.add(key19);
    }
    this.valuesCache = [...this.byKey.values()];
    this.valuesDirty = false;
  }
  upsert(nodes) {
    let changed = false;
    for (const node of nodes) {
      if (this.byKey.get(node.key) === node) continue;
      this.updateTurnKind(this.byKey.get(node.key), node);
      this.byKey.set(node.key, node);
      this.dirtyKeys.add(node.key);
      this.dirtyProcessKeys.add(node.key);
      changed = true;
    }
    if (changed) this.valuesDirty = true;
  }
  touchProcesses(turns, locations) {
    for (const turn of turns) {
      for (const key19 of locations.getTurn(turn)) this.dirtyProcessKeys.add(key19);
    }
  }
  replaceProcesses(order, locations) {
    this.touchProcesses(this.turnProcesses.replace(order, locations, this), locations);
  }
  updateProcesses(turns, locations) {
    this.touchProcesses(this.turnProcesses.update(turns, locations, this), locations);
  }
  publish() {
    const dirty = [...this.dirtyKeys];
    const dirtyProcesses = [...this.dirtyProcessKeys];
    const dirtyTurnKinds = [...this.dirtyTurnKinds];
    this.dirtyKeys.clear();
    this.dirtyProcessKeys.clear();
    this.dirtyTurnKinds.clear();
    for (const key19 of dirty) this.sources.get(key19)?.publish();
    for (const key19 of dirtyProcesses) this.processSources.get(key19)?.publish();
    for (const collection of dirtyTurnKinds) collection.publish();
  }
};
var MutableChatLocationIndex = class {
  turns = /* @__PURE__ */ new Map();
  steps = /* @__PURE__ */ new Map();
  positions = /* @__PURE__ */ new Map();
  getTurn(turn) {
    return this.turns.get(turn) ?? EMPTY_KEYS;
  }
  getStep(turn, step) {
    return this.steps.get(stepKey(turn, step)) ?? EMPTY_KEYS;
  }
  getPosition(key19) {
    return this.positions.get(key19);
  }
  rebuild(order, store) {
    const turns = /* @__PURE__ */ new Map();
    const steps = /* @__PURE__ */ new Map();
    const positions = /* @__PURE__ */ new Map();
    const changedTurns = /* @__PURE__ */ new Set();
    for (const [index, key19] of order.entries()) {
      const location = store.get(key19)?.location;
      if (location === void 0) continue;
      const coordinates = locationCoordinates(location);
      const previous = this.positions.get(key19);
      const position = {
        turn: coordinates.turn,
        previous: order[index - 1],
        next: order[index + 1]
      };
      const unchanged = previous !== void 0 && previous.turn === position.turn && previous.previous === position.previous && previous.next === position.next;
      positions.set(key19, unchanged ? previous : position);
      if (!unchanged) {
        if (previous?.turn !== void 0) changedTurns.add(previous.turn);
        if (position.turn !== void 0) changedTurns.add(position.turn);
      }
      if (coordinates.turn === void 0) continue;
      const turnKeys = turns.get(coordinates.turn) ?? [];
      turnKeys.push(key19);
      turns.set(coordinates.turn, turnKeys);
      if (coordinates.step === void 0) continue;
      const step = stepKey(coordinates.turn, coordinates.step);
      const stepKeys = steps.get(step) ?? [];
      stepKeys.push(key19);
      steps.set(step, stepKeys);
    }
    for (const [key19, position] of this.positions) {
      if (!positions.has(key19) && position.turn !== void 0) changedTurns.add(position.turn);
    }
    this.positions = positions;
    this.turns = updateIndex(this.turns, turns);
    this.steps = updateIndex(this.steps, steps);
    return [...changedTurns];
  }
  /** Invalidate aggregate readers when member data changes without moving. */
  touch(nodes) {
    const turns = /* @__PURE__ */ new Set();
    const steps = /* @__PURE__ */ new Set();
    for (const node of nodes) {
      const coordinates = locationCoordinates(node.location);
      if (coordinates.turn === void 0 || !this.turns.get(coordinates.turn)?.includes(node.key)) continue;
      turns.add(coordinates.turn);
      if (coordinates.step !== void 0) steps.add(stepKey(coordinates.turn, coordinates.step));
    }
    for (const turn of turns) {
      const keys = this.turns.get(turn);
      if (keys === void 0) continue;
      this.turns.set(turn, [...keys]);
    }
    for (const step of steps) {
      const keys = this.steps.get(step);
      if (keys === void 0) continue;
      this.steps.set(step, [...keys]);
    }
  }
};
function updateIndex(previous, nextMutable) {
  const next = /* @__PURE__ */ new Map();
  const keys = /* @__PURE__ */ new Set([...previous.keys(), ...nextMutable.keys()]);
  for (const key19 of keys) {
    const before = previous.get(key19) ?? EMPTY_KEYS;
    const candidate = nextMutable.get(key19) ?? EMPTY_KEYS;
    const value = sameReferences(before, candidate) ? before : candidate;
    if (candidate.length > 0) next.set(key19, value);
  }
  return next;
}
var MutableTurnNavigationIndex = class {
  current = EMPTY_ITEMS2;
  byTurn = /* @__PURE__ */ new Map();
  items() {
    return this.current;
  }
  /** Re-derive the whole Turn set; runs only when the loaded structure moves. */
  rebuild(timeline, locations, nodes) {
    const next = [];
    const byTurn = /* @__PURE__ */ new Map();
    for (const turn of timeline.turnOrder) {
      const derived = turnNavigationItem(turn, locations, nodes);
      if (derived === void 0) continue;
      const previous = this.byTurn.get(turn);
      const item = previous !== void 0 && sameTurnNavigationItem(previous, derived) ? previous : derived;
      next.push(item);
      byTurn.set(turn, item);
    }
    this.byTurn = byTurn;
    const unchanged = next.length === this.current.length && next.every((item, index) => item === this.current[index]);
    if (!unchanged) this.current = next;
  }
  /** Re-derive only the Turns a content-only upsert touched. */
  touch(turns, locations, nodes) {
    if (turns.size === 0) return;
    const next = this.current.map((item) => {
      if (!turns.has(item.turn)) return item;
      const derived = turnNavigationItem(item.turn, locations, nodes);
      if (derived === void 0 || sameTurnNavigationItem(item, derived)) return item;
      this.byTurn.set(item.turn, derived);
      return derived;
    });
    if (next.some((item, index) => item !== this.current[index])) this.current = next;
  }
};
function stepKey(turn, step) {
  return `${turn}:${step}`;
}
function locationCoordinates(location) {
  if (location.kind === "step") return { turn: location.turn.turn, step: location.step.step };
  if (location.kind === "turn") return { turn: location.turn.turn };
  return {};
}
function locationTurnStatus(location) {
  return location.kind === "turn" || location.kind === "step" ? location.turn.status : void 0;
}
function processPresentationInputChanged(previous, next, structural) {
  if (structural || previous === void 0) return true;
  if (locationTurnStatus(previous.location) !== locationTurnStatus(next.location)) return true;
  if (previous.kind === "turn-process" && next.kind === "turn-process") {
    return previous.data !== next.data;
  }
  return previous.kind === "assistant-step" && next.kind === "assistant-step" && previous.data.step !== next.data.step;
}
function turnProcessPresentations(nodes) {
  const presentations = /* @__PURE__ */ new Map();
  for (const raw of nodes) {
    const node = raw;
    if (node.kind === "turn-process") {
      presentations.set(node.data.turn, { ...presentations.get(node.data.turn), control: node });
    }
  }
  for (const raw of nodes) {
    const node = raw;
    const location = node.location;
    if (location.kind !== "turn" && location.kind !== "step") continue;
    const current = presentations.get(location.turn.turn) ?? {};
    const controlAnchor = current.control?.data.controlAnchorSeq;
    if ((node.kind === "user" || node.kind === "turn-trigger" || node.kind === "steering") && controlAnchor !== void 0 && (controlAnchor === location.turn.start?.seq || node.anchorSeq < controlAnchor)) {
      presentations.set(location.turn.turn, {
        ...current,
        openingInputAnchor: Math.max(current.openingInputAnchor ?? node.anchorSeq, node.anchorSeq)
      });
      continue;
    }
    if (TURN_PROCESS_INDEPENDENT_KINDS.has(node.kind)) continue;
    presentations.set(location.turn.turn, {
      ...current,
      earliestProcessAnchor: Math.min(current.earliestProcessAnchor ?? node.anchorSeq, node.anchorSeq)
    });
  }
  return presentations;
}
function presentationPosition(raw, presentations) {
  const node = raw;
  const location = node.location;
  if (location.kind !== "turn" && location.kind !== "step") {
    return { anchor: node.anchorSeq, rank: 0, originalAnchor: node.anchorSeq };
  }
  const presentation = presentations.get(location.turn.turn);
  if (presentation === void 0) {
    return { anchor: node.anchorSeq, rank: 0, originalAnchor: node.anchorSeq };
  }
  const openingInputAnchor = presentation.openingInputAnchor;
  if (openingInputAnchor !== void 0 && node.anchorSeq < openingInputAnchor && !TURN_PROCESS_INDEPENDENT_KINDS.has(node.kind)) {
    return { anchor: openingInputAnchor, rank: 2, originalAnchor: node.anchorSeq };
  }
  if (presentation.control !== void 0 && node.key === presentation.control.key) {
    return openingInputAnchor === void 0 ? {
      anchor: presentation.earliestProcessAnchor ?? node.anchorSeq,
      rank: -1,
      originalAnchor: node.anchorSeq
    } : { anchor: openingInputAnchor, rank: 1, originalAnchor: node.anchorSeq };
  }
  return { anchor: node.anchorSeq, rank: 0, originalAnchor: node.anchorSeq };
}
function orderedVisibleChatNodes(nodes) {
  const visible = nodes.filter((node) => isVisibleChatNode(node));
  const presentations = turnProcessPresentations(visible);
  return visible.sort((left, right) => {
    const leftPosition = presentationPosition(left, presentations);
    const rightPosition = presentationPosition(right, presentations);
    return leftPosition.anchor - rightPosition.anchor || leftPosition.rank - rightPosition.rank || leftPosition.originalAnchor - rightPosition.originalAnchor || left.key.localeCompare(right.key);
  });
}
function referenceMessageSeq(node) {
  const candidate = node;
  return candidate.kind === "user" || candidate.kind === "steering" ? candidate.data.seq : void 0;
}
function followingRecall(node) {
  const candidate = node;
  if (candidate.kind !== "context") return void 0;
  return {
    messageSeq: candidate.data.seq - 1,
    labels: sessionRecallLabels(candidate.data.source)
  };
}
function withReferenceLabels(node, labels) {
  const candidate = node;
  if (candidate.kind !== "user" && candidate.kind !== "steering") return node;
  const current = candidate.data.referenceLabels ?? EMPTY_KEYS;
  const hasLabels = Object.hasOwn(candidate.data, "referenceLabels");
  if (sameReferences(current, labels) && hasLabels === labels.length > 0) return node;
  const data = { ...candidate.data };
  if (labels.length === 0) delete data.referenceLabels;
  else data.referenceLabels = labels;
  return { ...candidate, data };
}
var ReferenceLabelProjector = class {
  messagesBySeq = /* @__PURE__ */ new Map();
  labelsByMessageSeq = /* @__PURE__ */ new Map();
  replace(nodes) {
    this.messagesBySeq.clear();
    this.labelsByMessageSeq.clear();
    for (const node of nodes) {
      const messageSeq = referenceMessageSeq(node);
      if (messageSeq !== void 0) this.messagesBySeq.set(messageSeq, node.key);
      const recall = followingRecall(node);
      if (recall !== void 0 && recall.labels.length > 0) {
        this.labelsByMessageSeq.set(recall.messageSeq, recall.labels);
      }
    }
    return nodes.map((node) => {
      const messageSeq = referenceMessageSeq(node);
      return messageSeq === void 0 ? node : withReferenceLabels(node, this.labelsByMessageSeq.get(messageSeq) ?? EMPTY_KEYS);
    });
  }
  apply(upserts, store) {
    const byKey = new Map(upserts.map((node) => [node.key, node]));
    const affected = /* @__PURE__ */ new Set();
    for (const node of upserts) {
      const messageSeq = referenceMessageSeq(node);
      if (messageSeq !== void 0) {
        this.messagesBySeq.set(messageSeq, node.key);
        affected.add(messageSeq);
      }
      const recall = followingRecall(node);
      if (recall === void 0) continue;
      const current = this.labelsByMessageSeq.get(recall.messageSeq);
      if (recall.labels.length === 0) this.labelsByMessageSeq.delete(recall.messageSeq);
      else {
        this.labelsByMessageSeq.set(
          recall.messageSeq,
          current !== void 0 && sameReferences(current, recall.labels) ? current : recall.labels
        );
      }
      affected.add(recall.messageSeq);
    }
    for (const messageSeq of affected) {
      const key19 = this.messagesBySeq.get(messageSeq);
      if (key19 === void 0) continue;
      const node = byKey.get(key19) ?? store.get(key19);
      if (node === void 0) continue;
      byKey.set(key19, withReferenceLabels(node, this.labelsByMessageSeq.get(messageSeq) ?? EMPTY_KEYS));
    }
    return [...byKey.values()];
  }
};
function withSkillNames(node, names) {
  const candidate = node;
  if (candidate.kind !== "user" && candidate.kind !== "steering") return node;
  const current = candidate.data.skillNames ?? EMPTY_KEYS;
  const hasNames = Object.hasOwn(candidate.data, "skillNames");
  if (sameReferences(current, names) && hasNames === names.length > 0) return node;
  const data = { ...candidate.data };
  if (names.length === 0) delete data.skillNames;
  else data.skillNames = names;
  return { ...candidate, data };
}
function slashEntryOf(node) {
  const candidate = node;
  if (candidate.kind === "user" || candidate.kind === "steering") {
    return { key: node.key, seq: node.anchorSeq, kind: "message", name: null };
  }
  if (candidate.kind === "context") {
    const name = skillInvocationName(candidate.data.source);
    return name === null ? null : { key: node.key, seq: node.anchorSeq, kind: "skill", name };
  }
  return { key: node.key, seq: node.anchorSeq, kind: "boundary", name: null };
}
function sameSlashEntry(left, right) {
  return left.seq === right.seq && left.kind === right.kind && left.name === right.name;
}
var SkillNameProjector = class {
  entries = /* @__PURE__ */ new Map();
  /** Every indexed entry in `anchorSeq` order. */
  sorted = [];
  /**
   * Rebuild the index from a whole Node set and attach names to its messages.
   * @param nodes - every materialized Chat Node, in any order.
   * @returns the same Nodes, direct messages carrying their batch's names.
   */
  replace(nodes) {
    this.entries.clear();
    this.sorted = [];
    for (const node of nodes) {
      const entry = slashEntryOf(node);
      if (entry === null) continue;
      this.entries.set(entry.key, entry);
      this.sorted.push(entry);
    }
    this.sorted.sort((left, right) => left.seq - right.seq);
    const names = /* @__PURE__ */ new Map();
    for (let index = 0; index < this.sorted.length; index++) {
      if (this.sorted[index]?.kind === "boundary") continue;
      const end = this.runEnd(index);
      this.assignRun(index, end, names);
      index = end;
    }
    return nodes.map((node) => withSkillNames(node, names.get(node.key) ?? EMPTY_KEYS));
  }
  /**
   * Fold one incremental upsert set: re-read only the batches around the
   * Nodes whose classification changed.
   * @param upserts - the changed Nodes.
   * @param store - the resident Nodes, read by key for the messages of an affected batch.
   * @returns the upserts plus any resident message whose names changed.
   */
  apply(upserts, store) {
    const dirty = [];
    for (const node of upserts) {
      const next = slashEntryOf(node);
      const previous = this.entries.get(node.key);
      if (previous !== void 0) {
        if (next !== null && sameSlashEntry(previous, next)) {
          if (next.kind === "message") dirty.push(next.seq);
          continue;
        }
        this.remove(previous);
        dirty.push(previous.seq);
      }
      if (next === null) continue;
      this.insert(next);
      dirty.push(next.seq);
    }
    if (dirty.length === 0) return upserts;
    const names = /* @__PURE__ */ new Map();
    for (const seq of dirty) this.collectAround(seq, names);
    const byKey = new Map(upserts.map((node) => [node.key, node]));
    for (const [key19, list] of names) {
      const node = byKey.get(key19) ?? store.get(key19);
      if (node === void 0) continue;
      const next = withSkillNames(node, list);
      if (next !== node || byKey.has(key19)) byKey.set(key19, next);
    }
    return [...byKey.values()];
  }
  insert(entry) {
    this.sorted.splice(this.lowerBound(entry.seq), 0, entry);
    this.entries.set(entry.key, entry);
  }
  remove(entry) {
    this.sorted.splice(this.sorted.indexOf(entry), 1);
    this.entries.delete(entry.key);
  }
  /** First index whose seq is at least `seq`. */
  lowerBound(seq) {
    let low = 0;
    let high = this.sorted.length;
    while (low < high) {
      const middle = low + high >>> 1;
      if ((this.sorted[middle]?.seq ?? Number.POSITIVE_INFINITY) < seq) low = middle + 1;
      else high = middle;
    }
    return low;
  }
  /** Last index of the boundary-free run containing `index`. */
  runEnd(index) {
    let end = index;
    while (end + 1 < this.sorted.length && this.sorted[end + 1]?.kind !== "boundary") end++;
    return end;
  }
  /** First index of the boundary-free run containing `index`. */
  runStart(index) {
    let start = index;
    while (start - 1 >= 0 && this.sorted[start - 1]?.kind !== "boundary") start--;
    return start;
  }
  /** Record the names every message of the run `[start, end]` carries. */
  assignRun(start, end, names) {
    const list = [];
    for (let index = start; index <= end; index++) {
      const entry = this.sorted[index];
      if (entry?.kind === "skill" && entry.name !== null && !list.includes(entry.name)) list.push(entry.name);
    }
    for (let index = start; index <= end; index++) {
      const entry = this.sorted[index];
      if (entry?.kind === "message") names.set(entry.key, list);
    }
  }
  /**
   * Re-read the run(s) around one changed seq: the run holding a message or
   * skill entry, or — for a boundary, or a seq that left the index — the runs
   * on both sides of that position.
   */
  collectAround(seq, names) {
    const at = this.lowerBound(seq);
    const here = this.sorted[at];
    if (here !== void 0 && here.seq === seq && here.kind !== "boundary") {
      this.assignRun(this.runStart(at), this.runEnd(at), names);
      return;
    }
    if (at - 1 >= 0 && this.sorted[at - 1]?.kind !== "boundary") {
      this.assignRun(this.runStart(at - 1), at - 1, names);
    }
    const right = here !== void 0 && here.seq === seq ? at + 1 : at;
    if (right < this.sorted.length && this.sorted[right]?.kind !== "boundary") {
      this.assignRun(right, this.runEnd(right), names);
    }
  }
};
var EMPTY_CONTRIBUTION = {
  anchorSeq: 0,
  nodes: EMPTY_LIST2,
  partial: null,
  running: null
};
function legacyContribution(raw) {
  const node = raw;
  if (raw.visibility !== "visible" && node.kind !== "assistant-step") return EMPTY_CONTRIBUTION;
  switch (node.kind) {
    case "user":
    case "steering":
    case "context":
    case "command":
    case "compaction":
    case "turn-error":
    case "turn-max-tokens":
    case "unknown":
      return { anchorSeq: node.anchorSeq, nodes: [node.data], partial: null, running: null };
    case "assistant-step": {
      const data = node.data;
      if (data.status === "running") {
        if (raw.visibility !== "visible") return EMPTY_CONTRIBUTION;
        return {
          anchorSeq: node.anchorSeq,
          nodes: EMPTY_LIST2,
          partial: { turn: data.turn, step: data.step, blocks: data.blocks },
          running: null
        };
      }
      return {
        anchorSeq: node.anchorSeq,
        nodes: data.finalNode === void 0 ? EMPTY_LIST2 : [data.finalNode],
        partial: null,
        running: null
      };
    }
    case "tool-call": {
      const root = node.data.root;
      return isRunningTool(root) ? { anchorSeq: node.anchorSeq, nodes: EMPTY_LIST2, partial: null, running: root } : { anchorSeq: node.anchorSeq, nodes: [root], partial: null, running: null };
    }
    case "manual-compaction": {
      const data = node.data;
      return {
        anchorSeq: node.anchorSeq,
        nodes: data.compaction === null ? [data.command] : [data.command, data.compaction],
        partial: null,
        running: null
      };
    }
    case "model-retry":
      return {
        anchorSeq: node.anchorSeq,
        nodes: node.data.attempts,
        partial: null,
        running: null
      };
    case "turn-tail":
    case "system-prompt":
      return EMPTY_CONTRIBUTION;
    default:
      return EMPTY_CONTRIBUTION;
  }
}
function sameContribution(left, right) {
  return left !== void 0 && left.anchorSeq === right.anchorSeq && left.partial?.blocks === right.partial?.blocks && left.partial?.turn === right.partial?.turn && left.partial?.step === right.partial?.step && left.running === right.running && sameReferences(left.nodes, right.nodes);
}
var LegacySliceBuilder = class {
  contributions = /* @__PURE__ */ new Map();
  finalizedContributions = /* @__PURE__ */ new Map();
  runningContributions = /* @__PURE__ */ new Map();
  partialContributions = /* @__PURE__ */ new Map();
  finalized = EMPTY_LIST2;
  runningCalls = EMPTY_LIST2;
  partial = null;
  timeline;
  turnTimings = /* @__PURE__ */ new Map();
  turnEnds = /* @__PURE__ */ new Map();
  replace(nodes, timeline) {
    this.contributions.clear();
    this.finalizedContributions.clear();
    this.runningContributions.clear();
    this.partialContributions.clear();
    for (const node of nodes) {
      const contribution = legacyContribution(node);
      this.contributions.set(node.key, contribution);
      this.indexContribution(node.key, contribution);
    }
    this.rebuildFinalized();
    this.rebuildRunning();
    this.rebuildPartial();
    this.updateTimeline(timeline);
    return this.snapshot();
  }
  apply(upserts, timeline) {
    let finalizedChanged = false;
    let runningChanged = false;
    let partialChanged = false;
    for (const node of upserts) {
      const contribution = legacyContribution(node);
      const previous = this.contributions.get(node.key);
      if (sameContribution(previous, contribution)) continue;
      finalizedChanged ||= finalizedContributionChanged(previous, contribution);
      runningChanged ||= runningContributionChanged(previous, contribution);
      partialChanged ||= partialContributionChanged(previous, contribution);
      this.contributions.set(node.key, contribution);
      this.indexContribution(node.key, contribution);
    }
    if (finalizedChanged) this.rebuildFinalized();
    if (runningChanged) this.rebuildRunning();
    if (partialChanged) this.rebuildPartial();
    this.updateTimeline(timeline);
    return this.snapshot();
  }
  indexContribution(key19, contribution) {
    updateContributionIndex(this.finalizedContributions, key19, contribution, contribution.nodes.length > 0);
    updateContributionIndex(this.runningContributions, key19, contribution, contribution.running !== null);
    updateContributionIndex(this.partialContributions, key19, contribution, contribution.partial !== null);
  }
  rebuildFinalized() {
    const finalized = [...this.finalizedContributions.values()].flatMap((value) => value.nodes).sort((left, right) => left.seq - right.seq);
    if (!sameReferences(this.finalized, finalized)) this.finalized = finalized;
  }
  rebuildRunning() {
    const runningCalls = [...this.runningContributions.values()].sort((left, right) => left.anchorSeq - right.anchorSeq).flatMap((value) => value.running === null ? [] : [value.running]);
    if (!sameReferences(this.runningCalls, runningCalls)) this.runningCalls = runningCalls;
  }
  rebuildPartial() {
    const partial = [...this.partialContributions.values()].sort((left, right) => left.anchorSeq - right.anchorSeq).findLast((value) => value.partial !== null)?.partial ?? null;
    if (this.partial?.blocks !== partial?.blocks || this.partial?.turn !== partial?.turn || this.partial?.step !== partial?.step) this.partial = partial;
  }
  updateTimeline(timeline) {
    if (this.timeline === timeline) return;
    this.timeline = timeline;
    const turnTimings = /* @__PURE__ */ new Map();
    const turnEnds = /* @__PURE__ */ new Map();
    for (const turn of timeline.turns.values()) {
      if (turn.start !== void 0) {
        turnTimings.set(turn.turn, {
          startTime: turn.start.time,
          ...turn.end === void 0 ? {} : { endTime: turn.end.time }
        });
      }
      if (turn.end !== void 0) turnEnds.set(turn.turn, turn.end.seq);
    }
    this.turnTimings = turnTimings;
    this.turnEnds = turnEnds;
  }
  snapshot() {
    return {
      nodes: this.finalized,
      turnTimings: this.turnTimings,
      turnEnds: this.turnEnds,
      partial: this.partial,
      runningCalls: this.runningCalls
    };
  }
};
function updateContributionIndex(index, key19, contribution, present) {
  if (present) index.set(key19, contribution);
  else index.delete(key19);
}
function finalizedContributionChanged(previous, next) {
  const previousNodes = previous?.nodes ?? EMPTY_LIST2;
  return !sameReferences(previousNodes, next.nodes) || (previousNodes.length > 0 || next.nodes.length > 0) && previous?.anchorSeq !== next.anchorSeq;
}
function runningContributionChanged(previous, next) {
  return previous?.running !== next.running || (previous.running !== null || next.running !== null) && previous.anchorSeq !== next.anchorSeq;
}
function partialContributionChanged(previous, next) {
  return previous?.partial?.blocks !== next.partial?.blocks || previous?.partial?.turn !== next.partial?.turn || previous?.partial?.step !== next.partial?.step || ((previous?.partial ?? null) !== null || next.partial !== null) && previous?.anchorSeq !== next.anchorSeq;
}
var ChatSnapshotBuilder = class {
  messageEdits = new ChatMessageEditProjector();
  store = new MutableChatNodeStore();
  locations = new MutableChatLocationIndex();
  navigation = new MutableTurnNavigationIndex();
  legacy = new LegacySliceBuilder();
  referenceLabels = new ReferenceLabelProjector();
  skillNames = new SkillNameProjector();
  order = EMPTY_KEYS;
  latestGroupInput;
  readGroupNode = (key19) => this.store.get(key19);
  readGroupTurn = (turn) => this.locations.getTurn(turn);
  readGroupPosition = (key19) => this.locations.getPosition(key19);
  /** Last published timeline: a Turn boundary can land without a new node. */
  timeline = null;
  empty;
  constructor() {
    this.empty = this.snapshot({ turnOrder: EMPTY_TURNS, turns: /* @__PURE__ */ new Map() });
    this.latestGroupInput = {
      kind: "replace",
      order: this.order,
      readNode: this.readGroupNode,
      readTurn: this.readGroupTurn,
      readPosition: this.readGroupPosition,
      timeline: this.empty.timeline
    };
  }
  replace(input) {
    const nodes = this.skillNames.replace(this.referenceLabels.replace(this.messageEdits.replace(input.nodes)));
    this.store.replace(nodes);
    this.order = orderedVisibleChatNodes(nodes).map((node) => node.key);
    this.locations.rebuild(this.order, this.store);
    this.store.replaceProcesses(this.order, this.locations);
    this.navigation.rebuild(input.timeline, this.locations, this.store);
    this.timeline = input.timeline;
    this.latestGroupInput = {
      kind: "replace",
      order: this.order,
      readNode: this.readGroupNode,
      readTurn: this.readGroupTurn,
      readPosition: this.readGroupPosition,
      timeline: input.timeline
    };
    const snapshot2 = this.snapshot(input.timeline, this.legacy.replace(nodes, input.timeline));
    return snapshot2;
  }
  apply(input) {
    const upserts = this.skillNames.apply(this.referenceLabels.apply(this.messageEdits.apply(input.upserts), this.store), this.store);
    const processTurns = /* @__PURE__ */ new Set();
    let structural = false;
    const contentOnly = [];
    const changes = [];
    for (const node of upserts) {
      const previous = this.store.get(node.key);
      if (previous !== node) changes.push({ previous, current: node });
      const nodeStructural = previous === void 0 || previous.kind !== node.kind || previous.anchorSeq !== node.anchorSeq || previous.visibility !== node.visibility || locationIdentity(previous.location) !== locationIdentity(node.location);
      structural ||= nodeStructural;
      if (!nodeStructural) contentOnly.push(node);
      if (processPresentationInputChanged(previous, node, nodeStructural)) {
        const previousTurn = previous === void 0 ? void 0 : locationCoordinates(previous.location).turn;
        const nextTurn = locationCoordinates(node.location).turn;
        if (previousTurn !== void 0) processTurns.add(previousTurn);
        if (nextTurn !== void 0) processTurns.add(nextTurn);
      }
    }
    this.store.upsert(upserts);
    let changedTurnOrders = EMPTY_TURNS;
    if (structural) {
      const next = orderedVisibleChatNodes(this.store.values()).map((node) => node.key);
      this.order = sameReferences(this.order, next) ? this.order : next;
      changedTurnOrders = this.locations.rebuild(this.order, this.store);
    }
    this.locations.touch(contentOnly);
    this.store.updateProcesses(processTurns, this.locations);
    if (structural || input.timeline !== this.timeline) {
      this.navigation.rebuild(input.timeline, this.locations, this.store);
    } else {
      this.navigation.touch(turnsOf(contentOnly), this.locations, this.store);
    }
    this.timeline = input.timeline;
    this.latestGroupInput = {
      kind: "apply",
      changes,
      order: this.order,
      readNode: this.readGroupNode,
      readTurn: this.readGroupTurn,
      readPosition: this.readGroupPosition,
      timeline: input.timeline,
      changedTurns: input.changedTurns ?? EMPTY_TURNS,
      changedTurnOrders
    };
    const snapshot2 = this.snapshot(input.timeline, this.legacy.apply(upserts, input.timeline));
    return snapshot2;
  }
  groupInput() {
    return this.latestGroupInput;
  }
  publish() {
    this.store.publish();
  }
  snapshot(timeline, legacy = this.legacy.replace(EMPTY_LIST2, timeline)) {
    return {
      order: this.order,
      nodes: this.store,
      locations: this.locations,
      navigation: this.navigation,
      timeline,
      legacy
    };
  }
};
function turnsOf(nodes) {
  const turns = /* @__PURE__ */ new Set();
  for (const node of nodes) {
    const turn = locationCoordinates(node.location).turn;
    if (turn !== void 0) turns.add(turn);
  }
  return turns;
}
function locationIdentity(location) {
  const coordinates = locationCoordinates(location);
  return `${location.kind}:${coordinates.turn ?? ""}:${coordinates.step ?? ""}`;
}
var chatViewDefinition = {
  target: "chat",
  create: () => new ChatSnapshotBuilder(),
  isActive: (snapshot2) => snapshot2.order.some((key19) => snapshot2.nodes.get(key19)?.kind !== "command")
};
function registerChatConversationView(ctx) {
  ctx.uiConversation.views.register(chatViewDefinition);
}

// conversation-nodes/command.ts
var COMPACT_KIND = "compact-checkpoint";
function commandFromRun(match) {
  if (match.event.type !== "command/run") throw new Error("command start requires command/run");
  const data = match.event.data;
  return {
    kind: "command",
    seq: match.event.seq,
    time: match.event.time,
    commandId: data.commandId,
    name: data.name,
    args: data.args ?? null,
    outcome: null
  };
}
function commandFromDone(match, previous) {
  if (match.event.type !== "command/done") throw new Error("command update requires command/done");
  const data = match.event.data;
  const sourceEventSeq = data.kind === "success" && data.sourceEventSeq !== void 0 && Number.isSafeInteger(data.sourceEventSeq) && data.sourceEventSeq >= 0 ? data.sourceEventSeq : void 0;
  return {
    kind: "command",
    seq: previous?.seq ?? match.event.seq,
    time: previous?.time ?? match.event.time,
    commandId: data.commandId,
    name: previous?.name ?? null,
    args: previous?.args ?? null,
    outcome: {
      kind: data.kind,
      ...data.text === void 0 ? {} : { text: data.text },
      ...sourceEventSeq === void 0 ? {} : { sourceEventSeq }
    }
  };
}
function compactSource(event) {
  if (event.type !== "user/message" || !isReplacementSurfaceEvent(event)) return void 0;
  const source = event.data.source;
  if (source.kind !== COMPACT_KIND || typeof source.compactionId !== "string") return void 0;
  return {
    compactionId: source.compactionId,
    ...source.sourceCommandId === void 0 ? {} : { sourceCommandId: source.sourceCommandId }
  };
}
function compactSummary(match, checkpoint) {
  let summary = null;
  let shadowedItemCount = null;
  let shadowedTokenCount = null;
  if (match?.event.type === "compaction/summary") {
    const data = match.event.data;
    if (Array.isArray(data.summary)) {
      const text = data.summary.map((block) => block.type === "text" ? block.text : "").join("");
      summary = text.trim() === "" ? null : text;
    }
    shadowedItemCount = Array.isArray(data.shadowedSeqs) && data.shadowedSeqs.every((seq) => Number.isSafeInteger(seq) && seq >= 0) ? data.shadowedSeqs.length : null;
    shadowedTokenCount = Number.isSafeInteger(data.shadowedTokenCount) && data.shadowedTokenCount >= 0 ? data.shadowedTokenCount : null;
  }
  return {
    kind: "compaction",
    seq: checkpoint.event.seq,
    time: checkpoint.event.time,
    summary,
    summaryEventSeq: match?.event.seq ?? null,
    shadowedItemCount,
    shadowedTokenCount
  };
}
function fallbackState2(context) {
  const done = context.matches.find((match) => match.event.type === "command/done");
  const checkpoint = context.matches.find((match) => compactSource(match.event) !== void 0);
  const summary = context.matches.find((match) => match.event.type === "compaction/summary");
  if (checkpoint === void 0) return done === void 0 ? void 0 : { command: commandFromDone(done) };
  const source = compactSource(checkpoint.event);
  if (source?.sourceCommandId === void 0) return done === void 0 ? void 0 : { command: commandFromDone(done) };
  const fallbackCommand = done === void 0 ? {
    kind: "command",
    seq: checkpoint.event.seq,
    time: checkpoint.event.time,
    commandId: source.sourceCommandId,
    name: "compact",
    args: null,
    outcome: null
  } : { ...commandFromDone(done), name: "compact" };
  return {
    command: fallbackCommand,
    checkpoint,
    ...summary === void 0 ? {} : { summary }
  };
}
function updateCompactionState(state, match) {
  if (match.event.type === "compaction/summary") return { ...state, summary: match };
  if (compactSource(match.event) !== void 0) return { ...state, checkpoint: match };
  return state;
}
var commandDefinition = {
  kind: "command",
  target: "chat",
  match: (event) => {
    if (event.type === "command/run") {
      return { id: String(event.data.commandId), role: "start" };
    }
    if (event.type === "command/done") {
      return { id: String(event.data.commandId), role: "update" };
    }
    const checkpoint = compactSource(event);
    if (checkpoint?.sourceCommandId !== void 0) {
      return { id: String(checkpoint.sourceCommandId), role: "update" };
    }
    if (event.type === "compaction/start" || event.type === "compaction/summary" || event.type === "compaction/end") {
      if (event.data.sourceCommandId !== void 0) {
        return { id: String(event.data.sourceCommandId), role: "update" };
      }
    }
    return null;
  },
  start: (_context, match) => ({ command: commandFromRun(match) }),
  update: (context, match) => {
    if (match.event.type === "command/done") {
      return { ...context.state, command: commandFromDone(match, context.state.command) };
    }
    return updateCompactionState(context.state, match);
  },
  buildViewNode: (context) => {
    const state = context.state ?? fallbackState2(context);
    if (state === void 0) return null;
    if (state.command.name !== "compact") {
      return chatNode(context, "command", state.command.seq, state.command);
    }
    const compaction = state.checkpoint === void 0 ? null : compactSummary(state.summary, state.checkpoint);
    const data = { command: state.command, compaction };
    return chatNode(context, "manual-compaction", compaction?.seq ?? state.command.seq, data);
  }
};
function registerCommandConversationNode(ctx) {
  ctx.uiConversation.events.register(commandDefinition);
}

// conversation-nodes/compaction.ts
function fallbackState3(context) {
  const summary = context.matches.find((match) => match.event.type === "compaction/summary");
  const checkpoint = context.matches.find((match) => compactSource(match.event) !== void 0);
  return {
    ...summary === void 0 ? {} : { summary },
    ...checkpoint === void 0 ? {} : { checkpoint }
  };
}
var compactionDefinition = {
  kind: "compaction",
  target: "chat",
  match: (event) => {
    const checkpoint = compactSource(event);
    if (checkpoint !== void 0 && checkpoint.sourceCommandId === void 0) {
      return { id: checkpoint.compactionId, role: "update" };
    }
    if (event.type === "compaction/start" || event.type === "compaction/summary" || event.type === "compaction/end") {
      if (event.data.sourceCommandId !== void 0) return null;
      const compactionId = event.data.compactionId;
      if (typeof compactionId !== "string" || compactionId === "") return null;
      return { id: compactionId, role: event.type === "compaction/start" ? "start" : "update" };
    }
    return null;
  },
  start: () => ({}),
  update: (context, match) => updateCompactionState(context.state, match),
  buildViewNode: (context) => {
    const state = context.state ?? fallbackState3(context);
    if (state.checkpoint === void 0) return null;
    const marker = compactSummary(state.summary, state.checkpoint);
    return chatNode(context, "compaction", marker.seq, marker);
  }
};
function registerCompactionConversationNode(ctx) {
  ctx.uiConversation.events.register(compactionDefinition);
}

// conversation-nodes/fallback.ts
var unknownFallbackDefinition = {
  kind: "unknown-surface",
  target: "chat",
  match: (event) => event.type !== "assistant/live-chunk" && isAppendSurfaceEvent(event) ? { id: String(event.seq), role: "start" } : null,
  start: (_context, match) => ({
    kind: "unknown",
    seq: match.event.seq,
    time: match.event.time,
    type: match.event.type,
    data: match.event.data
  }),
  update: (context) => context.state,
  buildViewNode: (context) => context.state === void 0 ? null : chatNode(context, "unknown", context.state.seq, context.state)
};
function registerUnknownConversationFallback(ctx) {
  ctx.uiConversation.events.registerFallback(unknownFallbackDefinition);
}

// conversation-nodes/inbox.ts
var EMPTY_PENDING = { kind: "snapshot", ids: [] };
var EMPTY_CURRENT_CLAIMED = /* @__PURE__ */ new Set();
function materializePending(state) {
  const splices = [];
  let current = state;
  while (current.kind === "splice") {
    splices.push(current);
    current = current.previous;
  }
  const pending = [...current.ids];
  for (const splice of splices.reverse()) {
    pending.splice(splice.start, splice.removedCount, ...splice.inserted);
  }
  return pending;
}
function withoutInserted(claimed, inserted) {
  let next;
  for (const { id } of inserted) {
    if (!claimed.has(id)) continue;
    next ??= new Set(claimed);
    next.delete(id);
  }
  return next ?? claimed;
}
function applySplice(previous, splice, seq) {
  const priorPending = previous?.state.pending ?? EMPTY_PENDING;
  const inserted = splice.inserted;
  const removedCount = splice.removedCount ?? 0;
  if (removedCount > 0 && splice.outcome !== "canceled") {
    const pending = materializePending(priorPending);
    const removed = pending.splice(splice.start, removedCount, ...inserted);
    return {
      pending: { kind: "snapshot", ids: pending },
      currentClaimed: new Set(removed.map((message) => message.id)),
      claimSeq: seq,
      claimedHuman: removed.some((message) => message.source.kind === "user")
    };
  }
  const currentClaimed = withoutInserted(
    previous?.state.currentClaimed ?? EMPTY_CURRENT_CLAIMED,
    inserted
  );
  return {
    pending: {
      kind: "splice",
      previous: priorPending,
      start: splice.start,
      removedCount,
      inserted
    },
    currentClaimed,
    claimSeq: previous?.state.claimSeq ?? -1,
    claimedHuman: previous?.state.claimedHuman ?? false
  };
}
function inboxDefinition(target) {
  const kind = `inbox-${target}`;
  return {
    kind,
    match: (event) => event.type === "agent/inbox/spliced" && event.data.target === target ? { id: String(event.seq), role: "start" } : null,
    start: (_context, match, reader) => {
      if (match.event.type !== "agent/inbox/spliced") throw new Error("inbox start requires agent/inbox/spliced");
      return applySplice(reader.previous(kind), match.event.data, match.event.seq);
    },
    update: (context) => context.state,
    publication: () => "none"
  };
}
var nextStepInboxDefinition = inboxDefinition("next-step");
var nextTurnInboxDefinition = inboxDefinition("next-turn");
function registerInboxConversationNodes(ctx) {
  ctx.uiConversation.events.register(nextStepInboxDefinition);
  ctx.uiConversation.events.register(nextTurnInboxDefinition);
}

// conversation-nodes/message.ts
function isCompactionCheckpoint(event) {
  if (event.type !== "user/message" || !isReplacementSurfaceEvent(event)) return false;
  const source = event.data.source;
  return source.kind === "compact-checkpoint";
}
var messageDefinition = {
  kind: "input-message",
  target: "chat",
  match: (event) => {
    if (event.type === "user/message") {
      return isAppendSurfaceEvent(event) && !isCompactionCheckpoint(event) ? { id: String(event.data.id), role: "start" } : null;
    }
    if (event.type === "developer/message") throw new Error("Chat developer messages are not supported yet");
    return null;
  },
  start: (_context, match, reader) => {
    if (match.event.type !== "user/message") throw new Error("input-message start requires user/message");
    const event = match.event;
    if (event.data.source.kind !== "user") {
      const nextTurn = reader.previous("inbox-next-turn")?.state;
      const nextStep = reader.previous("inbox-next-step")?.state;
      const location = match.location;
      const turnStart = location.kind === "step" ? location.turn.start?.seq : void 0;
      const idleSteer = location.kind === "step" && location.step.step === 1 && turnStart !== void 0 && (nextStep?.claimSeq ?? -1) > turnStart && (nextTurn?.claimSeq ?? -1) < turnStart && nextStep?.claimedHuman === false && nextStep.currentClaimed.has(String(event.data.id));
      return {
        kind: "context",
        waking: nextTurn?.currentClaimed.has(String(event.data.id)) === true || idleSteer,
        seq: event.seq,
        time: event.time,
        content: event.data.content,
        source: event.data.source,
        producer: contextProducer(event.data.source),
        form: contextForm(event.data.source)
      };
    }
    const claimed = reader.previous("inbox-next-step")?.state.currentClaimed.has(String(event.data.id)) === true;
    return claimed ? {
      kind: "steering",
      messageId: event.data.id,
      seq: event.seq,
      time: event.time,
      content: event.data.content,
      source: event.data.source
    } : {
      kind: "user",
      messageId: event.data.id,
      seq: event.seq,
      time: event.time,
      content: event.data.content,
      source: event.data.source
    };
  },
  update: (context) => context.state,
  buildViewNode: (context) => {
    if (context.state === void 0) return null;
    const waking = context.state.kind === "context" && context.start?.event.type === "user/message" && context.state.waking === true;
    return chatNode(context, waking ? "turn-trigger" : context.state.kind, context.state.seq, context.state);
  }
};
function registerMessageConversationNode(ctx) {
  ctx.uiConversation.events.register(messageDefinition);
}

// conversation-nodes/request-prompt.ts
function requestPromptAnchor(match, previous, isInitial) {
  if (match.location.kind !== "step") return match.event.seq;
  if (previous === void 0 && !isInitial) return match.event.seq;
  if (previous?.turn === match.location.turn.turn && previous.step === match.location.step.step) return match.event.seq;
  return match.location.step.step === 1 ? match.location.turn.start?.seq ?? match.location.step.start?.seq ?? match.event.seq : match.location.step.start?.seq ?? match.event.seq;
}
function stableRequestPromptAnchor(context, match, previous, isInitial) {
  const current = context.current.get("chat");
  return current?.kind === "system-prompt" ? current.anchorSeq : requestPromptAnchor(match, previous, isInitial);
}
function systemMessageDefinition(inspect) {
  return {
    kind: "system-message",
    target: "chat",
    match: (event) => event.type === "system/message" || "surfaceOp" in event && event.surfaceOp !== "append" ? { id: String(event.seq), role: "start" } : null,
    start: (_context, match, reader) => {
      return inspect(reader.previous("system-message")?.state, match.event);
    },
    update: (context) => context.state,
    buildViewNode: (context) => {
      const state = context.state?.introduced;
      if (state === void 0 || state.text === "" || context.start?.event.type !== "system/message" || context.start.event.surfaceOp !== "append") return null;
      const anchor = state.update ? state.seq : requestPromptAnchor(context.start, void 0, true);
      return chatNode(context, "system-prompt", anchor, { text: state.text, ...state.update ? { update: true } : {} });
    }
  };
}
function requestPromptDefinition(inspect) {
  return {
    kind: "request-prompt",
    target: "chat",
    match: (event) => event.type === "request/header" ? { id: String(event.seq), role: "start" } : null,
    start: (context, match, reader) => {
      if (match.event.type !== "request/header") {
        throw new Error("request-prompt start requires request/header");
      }
      const previous = reader.previous("request-prompt")?.state;
      const systemContext = reader.previous("system-message");
      const system = systemContext?.state.effective;
      const location = match.location.kind === "step" ? { turn: match.location.turn.turn, step: match.location.step.step } : {};
      const inspection = inspect(previous?.prompt, match.event, system);
      const change = inspection.change?.kind;
      const systemEvent = systemContext?.matches[0]?.event;
      const shownByUpdate = system !== void 0 && systemEvent?.type === "system/message" && systemEvent.surfaceOp === "append" && (system.update || previous === void 0) && system.turn === location.turn && system.step === location.step;
      return {
        anchorSeq: stableRequestPromptAnchor(
          context,
          match,
          previous,
          match.event.data.reason === "initial"
        ),
        showsPrompt: !shownByUpdate && (previous === void 0 || match.event.data.reason !== "change" || match.event.data.startsSeries === true || change === "system" || change === "system-and-tools"),
        ...location,
        ...inspection
      };
    },
    update: (context) => context.state,
    buildViewNode: (context) => {
      const state = context.state;
      if (state === void 0) return null;
      const current = context.current.get("chat");
      const visible = state.showsPrompt && state.prompt.system !== "";
      if (!visible && current?.kind !== "system-prompt") return null;
      return chatNode(
        context,
        "system-prompt",
        state.anchorSeq,
        { text: state.prompt.system },
        { visibility: visible ? "visible" : "hidden" }
      );
    }
  };
}
function registerRequestPromptConversationNode(ctx) {
  ctx.uiConversation.events.register(systemMessageDefinition(
    (previous, event) => ctx.uiConversation.inspectSystemPrompt(previous, event)
  ));
  ctx.uiConversation.events.register(requestPromptDefinition(
    (previous, event, system) => ctx.uiConversation.inspectRequestPrompt(previous, event, system)
  ));
}

// conversation-nodes/retry.ts
function scheduledNode(match) {
  if (match.event.type !== "llm/retry") return void 0;
  return {
    kind: "model-retry",
    seq: match.event.seq,
    time: match.event.time,
    retryState: "scheduled",
    ...match.event.data
  };
}
function isClosed(location) {
  return location.kind === "step" && location.step.status === "closed" || (location.kind === "step" || location.kind === "turn") && location.turn.status === "closed";
}
var retryDefinition = {
  kind: "model-retry",
  target: "chat",
  match: (event) => {
    if (event.type === "llm/retry") {
      const retryId = event.data.retryId;
      if (typeof retryId !== "string" || retryId === "") return null;
      return { id: retryId, role: event.data.retry === 1 ? "start" : "update" };
    }
    if (event.type === "llm/retry-started") {
      const retryId = event.data.retryId;
      return typeof retryId === "string" && retryId !== "" ? { id: retryId, role: "update" } : null;
    }
    return null;
  },
  start: (_context, match) => {
    const node = scheduledNode(match);
    if (node === void 0) throw new Error("model-retry start requires a valid llm/retry event");
    return { turn: node.turn, step: node.step, attempts: [node] };
  },
  update: (context, match) => {
    if (match.event.type === "llm/retry") {
      const node = scheduledNode(match);
      return node === void 0 ? context.state : { ...context.state, attempts: [...context.state.attempts, node] };
    }
    if (match.event.type !== "llm/retry-started") return context.state;
    const retry = match.event.data.retry;
    return {
      ...context.state,
      attempts: context.state.attempts.map((attempt) => attempt.retry === retry ? { ...attempt, retryState: "started" } : attempt)
    };
  },
  buildViewNode: (context) => {
    if (context.state === void 0 || context.state.attempts.length === 0) return null;
    const location = context.start?.location ?? context.matches[0]?.location ?? { kind: "unresolved" };
    const stateAttempts = context.state.attempts;
    const attempts = stateAttempts.map((attempt, index) => index === stateAttempts.length - 1 && attempt.retryState === "scheduled" && isClosed(location) ? { ...attempt, retryState: "cancelled" } : attempt);
    const current = attempts.at(-1);
    if (current === void 0) return null;
    const data = { attempts, current };
    return chatNode(context, "model-retry", attempts[0]?.seq ?? current.seq, data);
  }
};
function registerRetryConversationNode(ctx) {
  ctx.uiConversation.events.register(retryDefinition);
}

// conversation-nodes/tool.ts
var MAX_DEPTH = 256;
var projectedBlocks = /* @__PURE__ */ new WeakMap();
function jsonArguments(value) {
  return JSON.stringify(value);
}
function rootCall(match) {
  if (match.event.type !== "tool/call") throw new Error("tool-call start requires tool/call");
  return {
    callId: String(match.event.data.callId),
    name: match.event.data.name,
    argsRaw: match.event.data.arguments,
    turn: match.event.data.turn,
    step: match.event.data.step,
    time: match.event.time,
    subCalls: []
  };
}
function rootResult(match, previous) {
  if (match.event.type !== "tool/result") return void 0;
  const message = match.event.data.message;
  return {
    kind: "tool-result",
    seq: match.event.seq,
    time: match.event.time,
    callId: String(message.source.callId),
    call: previous === void 0 ? null : { name: previous.name, argsRaw: previous.argsRaw },
    callTime: previous?.time ?? null,
    content: message.content,
    isError: message.isError === true,
    ...match.event.data.error === void 0 ? {} : { error: match.event.data.error },
    meta: match.event.data.meta,
    subCalls: []
  };
}
function childCall(match, data) {
  return {
    callId: data.subCallId,
    parentCallId: data.parentCallId,
    name: data.name,
    argsRaw: jsonArguments(data.arguments),
    turn: locationTurn(match),
    step: locationStep(match),
    time: match.event.time,
    subCalls: []
  };
}
function childResult(match, data, previous) {
  return {
    kind: "tool-result",
    seq: match.event.seq,
    time: match.event.time,
    callId: data.subCallId,
    parentCallId: data.parentCallId,
    call: { name: data.name, argsRaw: jsonArguments(data.arguments) },
    callTime: previous?.time ?? null,
    content: data.content ?? [],
    isError: data.isError === true,
    ...data.error === void 0 ? {} : { error: data.error },
    subCalls: []
  };
}
function locationTurn(match) {
  return match.location.kind === "step" || match.location.kind === "turn" ? match.location.turn.turn : 0;
}
function locationStep(match) {
  return match.location.kind === "step" ? match.location.step.step : 0;
}
function acceptsEdge(state, parent, child) {
  if (parent === child || state.parents.has(child)) return false;
  let cursor = parent;
  let parentDepth = 0;
  const ancestors = /* @__PURE__ */ new Set();
  while (cursor !== void 0) {
    if (cursor === child || ancestors.has(cursor)) return false;
    ancestors.add(cursor);
    parentDepth++;
    cursor = state.parents.get(cursor);
  }
  const pending = [{ callId: child, depth: 1 }];
  const descendants = /* @__PURE__ */ new Set();
  let subtreeDepth = 0;
  for (const candidate of pending) {
    if (descendants.has(candidate.callId)) return false;
    descendants.add(candidate.callId);
    subtreeDepth = Math.max(subtreeDepth, candidate.depth);
    for (const nested of state.children.get(candidate.callId) ?? []) {
      pending.push({ callId: nested.callId, depth: candidate.depth + 1 });
    }
  }
  return parentDepth + subtreeDepth <= MAX_DEPTH;
}
function updateDispatch(state, match) {
  const event = match.event;
  if (event.type !== "tool/ptc-dispatch-start" && event.type !== "tool/ptc-dispatch") return state;
  const data = event.data;
  const parentCallId = String(data.parentCallId);
  const subCallId = String(data.subCallId);
  const siblings = state.children.get(parentCallId) ?? [];
  const index = siblings.findIndex((candidate) => candidate.callId === subCallId);
  if (event.type === "tool/ptc-dispatch-start") {
    if (index >= 0 || !acceptsEdge(state, parentCallId, subCallId)) return state;
    const children2 = new Map(state.children);
    children2.set(parentCallId, [...siblings, childCall(match, data)]);
    const parents2 = new Map(state.parents);
    parents2.set(subCallId, parentCallId);
    return { ...state, children: children2, parents: parents2 };
  }
  if (index < 0 && !acceptsEdge(state, parentCallId, subCallId)) return state;
  const previous = index < 0 ? void 0 : siblings[index];
  const settled = childResult(match, data, previous);
  const children = new Map(state.children);
  children.set(parentCallId, index < 0 ? [...siblings, settled] : siblings.map((child, at) => at === index ? settled : child));
  const parents = new Map(state.parents);
  if (index < 0) parents.set(subCallId, parentCallId);
  return { ...state, children, parents };
}
function projectBlock(block, state, interruptedAt, visited = /* @__PURE__ */ new Set(), depth = 1) {
  if (visited.has(block.callId) || depth > MAX_DEPTH) return { ...block, subCalls: [] };
  const nextVisited = new Set(visited);
  nextVisited.add(block.callId);
  const children = (state.children.get(block.callId) ?? block.subCalls).map((child) => projectBlock(child, state, interruptedAt, nextVisited, depth + 1));
  const interruptionSeq = "kind" in block ? void 0 : interruptedAt?.seq;
  const interruptionTime = "kind" in block ? void 0 : interruptedAt?.time;
  const cached = projectedBlocks.get(block);
  if (cached !== void 0 && cached.interruptionSeq === interruptionSeq && cached.interruptionTime === interruptionTime && sameReferences2(cached.children, children)) {
    return cached.value;
  }
  const projected = "kind" in block || interruptedAt === void 0 ? sameReferences2(block.subCalls, children) ? block : { ...block, subCalls: children } : {
    kind: "tool-result",
    seq: interruptedAt.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.interruptedFollowup,
    time: interruptedAt.time,
    callId: block.callId,
    ...block.parentCallId === void 0 ? {} : { parentCallId: block.parentCallId },
    call: { name: block.name, argsRaw: block.argsRaw },
    callTime: block.time,
    content: [],
    isError: true,
    error: { name: "Interrupted", code: "interrupted" },
    subCalls: children
  };
  projectedBlocks.set(block, { children, interruptionSeq, interruptionTime, value: projected });
  return projected;
}
function sameReferences2(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function interruption(context) {
  const location = context.start?.location;
  if (location?.kind === "step" && location.step.status === "closed") return location.step.end;
  if ((location?.kind === "step" || location?.kind === "turn") && location.turn.status === "closed") {
    return location.turn.end;
  }
  return void 0;
}
function fallbackState4(context) {
  const match = context.matches.find((candidate) => candidate.event.type === "tool/result");
  const root = match === void 0 ? void 0 : rootResult(match);
  if (root === void 0) return void 0;
  let state = { root, children: /* @__PURE__ */ new Map(), parents: /* @__PURE__ */ new Map() };
  for (const candidate of context.matches) state = updateDispatch(state, candidate);
  return state;
}
var toolDefinition = {
  kind: "tool-call",
  target: "chat",
  match: (event) => {
    if (event.type === "tool/call") return { id: String(event.data.callId), role: "start" };
    if (event.type === "tool/result" && isAppendSurfaceEvent(event)) {
      return { id: String(event.data.message.source.callId), role: "update" };
    }
    if (event.type === "tool/ptc-dispatch-start" || event.type === "tool/ptc-dispatch") {
      const rootCallId = event.data.rootCallId;
      return typeof rootCallId === "string" && rootCallId !== "" ? { id: rootCallId, role: "update" } : null;
    }
    return null;
  },
  start: (_context, match) => ({ root: rootCall(match), children: /* @__PURE__ */ new Map(), parents: /* @__PURE__ */ new Map() }),
  update: (context, match) => {
    if (match.event.type === "tool/result") {
      const running = "kind" in context.state.root ? void 0 : context.state.root;
      const result = rootResult(match, running);
      return result === void 0 ? context.state : { ...context.state, root: result };
    }
    return updateDispatch(context.state, match);
  },
  buildViewNode: (context) => {
    const state = context.state ?? fallbackState4(context);
    if (state === void 0) return null;
    const projected = projectBlock(state.root, state, interruption(context));
    const anchor = context.start?.event.seq ?? ("kind" in state.root ? state.root.seq : context.matches[0]?.event.seq ?? 0);
    return chatNode(context, "tool-call", anchor, { root: projected });
  }
};
function registerToolConversationNode(ctx) {
  ctx.uiConversation.events.register(toolDefinition);
}

// conversation-nodes/turn-error.ts
function lastStep(context) {
  const location = context.start?.location ?? context.matches[0]?.location;
  if (location?.kind !== "turn" && location?.kind !== "step") return 0;
  return location.turn.steps.at(-1)?.step ?? 0;
}
function failureFrom(match) {
  if (match.event.type !== "turn/end" || match.event.data.reason.kind !== "error") return void 0;
  const failure = match.event.data.reason.error;
  const display = displayFailure(failure);
  return {
    seq: match.event.seq,
    time: match.event.time,
    message: display.message,
    ...display.code === void 0 ? {} : { code: display.code }
  };
}
function fallbackState5(context) {
  const end = context.matches.find((match) => failureFrom(match) !== void 0);
  if (end?.event.type !== "turn/end") return void 0;
  const failure = failureFrom(end);
  if (failure === void 0) return void 0;
  return { turn: end.event.data.turn, failure };
}
var turnErrorDefinition = {
  kind: "turn-error",
  target: "chat",
  match: (event) => {
    if (event.type === "turn/start") return { id: String(event.data.turn), role: "start" };
    if (event.type === "turn/end" && event.data.reason.kind === "error") {
      return { id: String(event.data.turn), role: "update" };
    }
    return null;
  },
  start: (_context, match) => {
    if (match.event.type !== "turn/start") throw new Error("turn-error start requires turn/start");
    return { turn: match.event.data.turn };
  },
  update: (context, match) => {
    const failure = failureFrom(match);
    return failure === void 0 ? context.state : { ...context.state, failure };
  },
  buildViewNode: (context) => {
    const state = context.state ?? fallbackState5(context);
    if (state?.failure === void 0) return null;
    const failure = state.failure;
    const node = {
      kind: "turn-error",
      seq: failure.seq,
      time: failure.time,
      turn: state.turn,
      step: lastStep(context),
      message: failure.message,
      ...failure.code === void 0 ? {} : { code: failure.code }
    };
    return chatNode(context, "turn-error", node.seq, node);
  }
};
function registerTurnErrorConversationNode(ctx) {
  ctx.uiConversation.events.register(turnErrorDefinition);
}

// conversation-nodes/turn-max-tokens.ts
function lastStep2(context) {
  const location = context.start?.location ?? context.matches[0]?.location;
  if (location?.kind !== "turn" && location?.kind !== "step") return 0;
  return location.turn.steps.at(-1)?.step ?? 0;
}
function noticeAnchor(context, seq) {
  const location = context.start?.location ?? context.matches[0]?.location;
  if (location?.kind !== "turn" && location?.kind !== "step") return seq;
  const closing = location.turn.data.get("turn-tail")?.closing;
  return closing === null || closing === void 0 ? seq : closing.finalNode.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.maxTokensNotice;
}
function stateFrom(match) {
  if (match.event.type !== "turn/end" || match.event.data.reason.kind !== "max-tokens") return void 0;
  return { turn: match.event.data.turn, seq: match.event.seq, time: match.event.time };
}
var turnMaxTokensDefinition = {
  kind: "turn-max-tokens",
  target: "chat",
  match: (event) => {
    if (event.type === "turn/end" && event.data.reason.kind === "max-tokens") {
      return { id: String(event.data.turn), role: "start" };
    }
    return null;
  },
  start: (_context, match) => {
    const state = stateFrom(match);
    if (state === void 0) throw new Error("turn-max-tokens start requires a max-tokens turn/end");
    return state;
  },
  update: (context) => context.state,
  buildViewNode: (context) => {
    const state = context.state;
    if (state === void 0) return null;
    const node = {
      kind: "turn-max-tokens",
      seq: state.seq,
      time: state.time,
      turn: state.turn,
      step: lastStep2(context)
    };
    return chatNode(context, "turn-max-tokens", noticeAnchor(context, state.seq), node);
  }
};
function registerTurnMaxTokensConversationNode(ctx) {
  ctx.uiConversation.events.register(turnMaxTokensDefinition);
}

// conversation-nodes/roleplay-story.ts
function roleplayPhase(event) {
  if (event.type !== "user/message" || event.surfaceOp !== "append") return void 0;
  const source = event.data.source;
  if (source.kind !== "roleplay-tasks" || source.form !== "phase" || source.schemaVersion !== 1 || source.stage !== "after-story" || typeof source.turn !== "number" || !Number.isSafeInteger(source.turn) || source.turn < 1 || typeof source.storySeq !== "number" || !Number.isSafeInteger(source.storySeq) || source.storySeq < 0 || source.storySeq >= event.seq) return void 0;
  return { turn: source.turn, storySeq: source.storySeq, markerSeq: event.seq };
}
function phaseFromMatches(matches) {
  for (const match of matches) {
    const phase = roleplayPhase(match.event);
    if (phase !== void 0) return phase;
  }
  return void 0;
}
function roleplayStory(turn, proof) {
  if (proof === void 0 || proof.turn !== turn.turn || turn.start !== void 0 && proof.storySeq <= turn.start.seq || turn.end !== void 0 && proof.markerSeq >= turn.end.seq) return null;
  for (const step of turn.steps) {
    const data = step.data.get("assistant-step");
    if (data?.finalNode === void 0 || data.finalNode.seq !== proof.storySeq) continue;
    if (data.finalNode.interrupted || !hasAssistantReplyContent(data.blocks) || data.blocks.some((block) => block.kind === "tool-call")) return null;
    return data;
  }
  return null;
}

// conversation-nodes/turn-process.ts
function eventTurn(event) {
  const data = event.data;
  return roleplayPhase(event)?.turn ?? (typeof data.turn === "number" ? data.turn : void 0);
}
function visibleChunk(chunk) {
  if (chunk.type === "text-delta" || chunk.type === "reasoning-delta") return chunk.text.trim() !== "";
  if (chunk.type === "block-start") {
    return chunk.blockType !== "text" && chunk.blockType !== "reasoning" && chunk.blockType !== "tool-call";
  }
  if (chunk.type !== "block-end") return false;
  const block = chunk.block;
  if (block.type === "tool-call") return false;
  if (block.type === "text" || block.type === "reasoning") return block.text.trim() !== "";
  return true;
}
function visibleAssistantEvent(event) {
  if (event.type === "assistant/live-chunk") return visibleChunk(event.data.chunk);
  if (event.type === "assistant/attempt") return false;
  return event.type === "assistant/message" && event.surfaceOp === "append" && toAssistantBlocks(event.data.message.content).some((block) => {
    if (block.kind === "tool-call") return false;
    if (block.kind === "text" || block.kind === "reasoning") return block.text.trim() !== "";
    return true;
  });
}
function processEvidence(event) {
  if (visibleAssistantEvent(event)) {
    if (event.type !== "assistant/live-chunk" && event.type !== "assistant/message" && event.type !== "assistant/attempt") return void 0;
    return { kind: "assistant", seq: event.seq, step: event.data.step };
  }
  if (event.type === "tool/call" || event.type === "tool/result" && event.surfaceOp === "append" || event.type === "llm/retry") return { kind: "other", seq: event.seq };
  return void 0;
}
function turnLocation(context) {
  const location = context.start?.location ?? context.matches.at(-1)?.location;
  return location?.kind === "turn" || location?.kind === "step" ? location.turn : void 0;
}
function fallbackState6(context) {
  const turn = context.matches.map((match) => eventTurn(match.event)).find((candidate) => candidate !== void 0);
  if (turn === void 0) return void 0;
  let state = {
    turn,
    assistantStartByStep: /* @__PURE__ */ new Map(),
    messageCountByStep: /* @__PURE__ */ new Map(),
    messageCount: 0,
    toolCallCount: 0,
    subagentCount: 0
  };
  for (const match of context.matches) state = updateProcessState(state, match.event);
  return state;
}
function isFinalAssistant(data) {
  return data?.finalNode !== void 0;
}
function latestAnswer(turn, state) {
  if (state.roleplayPhase !== void 0) return roleplayStory(turn, state.roleplayPhase);
  const latestStep = turn.steps.at(-1);
  const data = latestStep?.data.get("assistant-step");
  if (!isFinalAssistant(data) || !hasAssistantReplyContent(data.blocks)) return null;
  return data.blocks.some((block) => block.kind === "tool-call") ? null : data;
}
function processSpec(state, turn) {
  const controlAnchorSeq = state.controlAnchorSeq ?? turn.start?.seq;
  if (controlAnchorSeq === void 0) return null;
  const answer = latestAnswer(turn, state);
  const maintenanceStartSeq = roleplayStory(turn, state.roleplayPhase) === null ? null : state.roleplayPhase.markerSeq;
  const counts = {
    messageCount: answer === null ? state.messageCount : [...state.messageCountByStep].filter(([step]) => step !== answer.step && (maintenanceStartSeq !== null || step < answer.step)).reduce((total, [, count]) => total + count, 0),
    toolCallCount: state.toolCallCount,
    subagentCount: state.subagentCount
  };
  if (answer === null) {
    return {
      turn: turn.turn,
      controlAnchorSeq,
      processStartSeq: controlAnchorSeq,
      answerAnchorSeq: null,
      answerStep: null,
      maintenanceStartSeq: null,
      inlineReasoning: false,
      ...counts
    };
  }
  const inlineReasoning = answer.blocks.some((block) => block.kind === "reasoning" && block.text.trim() !== "");
  const earlierAssistantSeq = Math.min(
    ...[...state.assistantStartByStep].filter(([step]) => step < answer.step).map(([, seq]) => seq)
  );
  const externalProcessSeq = Math.min(
    state.otherStartSeq ?? Number.POSITIVE_INFINITY,
    earlierAssistantSeq
  );
  return {
    turn: turn.turn,
    controlAnchorSeq,
    processStartSeq: turn.start?.seq ?? (maintenanceStartSeq !== null ? 0 : Number.isFinite(externalProcessSeq) ? externalProcessSeq : answer.presentationSeq),
    answerAnchorSeq: answer.presentationSeq,
    answerStep: answer.step,
    maintenanceStartSeq,
    inlineReasoning,
    ...counts
  };
}
function updateProcessState(state, event) {
  let current = state;
  const phase = roleplayPhase(event);
  if (phase?.turn === state.turn && current.roleplayPhase === void 0) current = { ...current, roleplayPhase: phase };
  if (event.type === "assistant/message" && event.surfaceOp === "append" && hasAssistantReplyContent(toAssistantBlocks(event.data.message.content))) {
    const messageCountByStep = new Map(current.messageCountByStep);
    messageCountByStep.set(event.data.step, (messageCountByStep.get(event.data.step) ?? 0) + 1);
    current = { ...current, messageCountByStep, messageCount: current.messageCount + 1 };
  }
  if (event.type === "tool/call") {
    const subagent = isSubagentDelegationTool(event.data.name);
    current = {
      ...current,
      toolCallCount: current.toolCallCount + (subagent ? 0 : 1),
      subagentCount: current.subagentCount + (subagent ? 1 : 0)
    };
  }
  const evidence = processEvidence(event);
  if (evidence === void 0) return current;
  if (evidence.kind === "other") {
    return current.otherStartSeq === void 0 ? {
      ...current,
      otherStartSeq: evidence.seq,
      controlAnchorSeq: Math.min(current.controlAnchorSeq ?? Number.POSITIVE_INFINITY, evidence.seq)
    } : current;
  }
  if (current.assistantStartByStep.has(evidence.step)) return current;
  const assistantStartByStep = new Map(current.assistantStartByStep);
  assistantStartByStep.set(evidence.step, evidence.seq);
  return {
    ...current,
    assistantStartByStep,
    controlAnchorSeq: Math.min(current.controlAnchorSeq ?? Number.POSITIVE_INFINITY, evidence.seq)
  };
}
var turnProcessDefinition = {
  kind: "turn-process",
  target: "chat",
  match: (event) => {
    if (event.type === "turn/start") return { id: String(event.data.turn), role: "start" };
    const turn = eventTurn(event);
    if (turn === void 0) return null;
    if (roleplayPhase(event) !== void 0 || event.type === "assistant/live-chunk" || event.type === "assistant/message" || event.type === "tool/call" || event.type === "tool/result" || event.type === "llm/retry" || event.type === "step/start" || event.type === "step/end" || event.type === "turn/end") {
      return { id: String(turn), role: "update" };
    }
    return null;
  },
  start: (_context, match) => {
    if (match.event.type !== "turn/start") throw new Error("turn-process start requires turn/start");
    return {
      turn: match.event.data.turn,
      assistantStartByStep: /* @__PURE__ */ new Map(),
      messageCountByStep: /* @__PURE__ */ new Map(),
      messageCount: 0,
      toolCallCount: 0,
      subagentCount: 0
    };
  },
  update: (context, match) => updateProcessState(context.state, match.event),
  publication: (match) => {
    if (match.event.type === "assistant/live-chunk") {
      const type = match.event.data.chunk.type;
      return type === "usage" || type === "finish" ? "none" : "animation-frame";
    }
    return "immediate";
  },
  buildLocationData: (context, scope, previous) => {
    if (scope !== "turn") return null;
    const state = context.state ?? fallbackState6(context);
    if (state === void 0) return null;
    const turn = turnLocation(context);
    if (turn === void 0) return null;
    const current = context.current.get("chat");
    const latestStep = turn.steps.at(-1);
    if (previous?.kind === "turn" && previous.key === "turn-process" && current?.kind === "turn-process" && current.data.answerAnchorSeq === null && state.roleplayPhase === void 0 && current.data.controlAnchorSeq === state.controlAnchorSeq && current.data.messageCount === state.messageCount && current.data.toolCallCount === state.toolCallCount && current.data.subagentCount === state.subagentCount && turn.status !== "closed" && latestStep?.status !== "closed") return previous;
    const spec = processSpec(state, turn);
    if (spec === null) return null;
    if (previous?.kind === "turn" && previous.turn === spec.turn && previous.key === "turn-process" && sameTurnProcessSpec(previous.value, spec)) return previous;
    return {
      kind: "turn",
      turn: turn.turn,
      key: "turn-process",
      value: spec
    };
  },
  buildViewNode: (context) => {
    const turn = turnLocation(context);
    const data = turn?.data.get("turn-process");
    if (turn === void 0 || data === void 0) return null;
    const current = context.current.get("chat");
    const state = context.state;
    if (current?.kind === "turn-process" && state !== void 0 && current.data.answerAnchorSeq === null && state.roleplayPhase === void 0 && current.data.controlAnchorSeq === state.controlAnchorSeq && current.data.messageCount === state.messageCount && current.data.toolCallCount === state.toolCallCount && current.data.subagentCount === state.subagentCount && turn.status !== "closed" && turn.steps.at(-1)?.status !== "closed" && current.location === (context.start?.location ?? context.matches[0]?.location)) return current;
    return chatNode(
      context,
      "turn-process",
      data.controlAnchorSeq + CHAT_SYNTHETIC_SEQ_OFFSETS.processControl,
      data
    );
  }
};
function registerTurnProcess(ctx) {
  ctx.uiConversation.events.register(turnProcessDefinition);
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-llm/lib/types/assistant-stream.js
function lastAssistantStreamChunk(stream, type) {
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record2 = stream[index];
    if (record2.type === "chunk" && record2.chunk.type === type)
      return record2.chunk;
  }
  return void 0;
}

// ../../../../build-tools/node_modules/@deepseek-ai/dsh-token-meter/lib/types/turn-usage.js
function isCount(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function safeSum(values) {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total))
      return void 0;
  }
  return total;
}
function messageRoute(message) {
  const { provider, model } = message.source;
  return provider.length > 0 && model.length > 0 ? { provider, model } : void 0;
}
function streamUsage(stream) {
  return lastAssistantStreamChunk(stream, "usage")?.usage;
}
function normalizeUsage(usage, route) {
  const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, reasoningTokens, totalTokens } = usage;
  if (!isCount(inputTokens) || !isCount(outputTokens))
    return void 0;
  if (cacheReadTokens !== void 0 && !isCount(cacheReadTokens))
    return void 0;
  if (cacheWriteTokens !== void 0 && !isCount(cacheWriteTokens))
    return void 0;
  if (reasoningTokens !== void 0 && (!isCount(reasoningTokens) || reasoningTokens > outputTokens)) {
    return void 0;
  }
  const knownPrompt = safeSum([
    inputTokens,
    ...cacheReadTokens === void 0 ? [] : [cacheReadTokens],
    ...cacheWriteTokens === void 0 ? [] : [cacheWriteTokens]
  ]);
  if (knownPrompt === void 0)
    return void 0;
  let exactTotal;
  if (totalTokens !== void 0) {
    if (!isCount(totalTokens))
      return void 0;
    const exactPrompt = totalTokens - outputTokens;
    if (!isCount(exactPrompt) || exactPrompt < knownPrompt)
      return void 0;
    if (cacheReadTokens !== void 0 && cacheWriteTokens !== void 0 && exactPrompt !== knownPrompt) {
      return void 0;
    }
    exactTotal = totalTokens;
  } else {
    if (cacheReadTokens === void 0 || cacheWriteTokens === void 0)
      return void 0;
    const derivedTotal = safeSum([knownPrompt, outputTokens]);
    if (derivedTotal === void 0)
      return void 0;
    exactTotal = derivedTotal;
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens: exactTotal,
    ...cacheReadTokens === void 0 ? {} : { cacheReadTokens },
    ...cacheWriteTokens === void 0 ? {} : { cacheWriteTokens },
    ...reasoningTokens === void 0 ? {} : { reasoningTokens },
    ...route === void 0 ? {} : { route }
  };
}
function aggregateAttempts(attempts) {
  if (attempts.length === 0)
    return void 0;
  const inputTokens = safeSum(attempts.map((attempt) => attempt.inputTokens));
  const outputTokens = safeSum(attempts.map((attempt) => attempt.outputTokens));
  const totalTokens = safeSum(attempts.map((attempt) => attempt.totalTokens));
  if (inputTokens === void 0 || outputTokens === void 0 || totalTokens === void 0)
    return void 0;
  const cacheRead = attempts.map((attempt) => attempt.cacheReadTokens);
  const cacheWrite = attempts.map((attempt) => attempt.cacheWriteTokens);
  const reasoning2 = attempts.map((attempt) => attempt.reasoningTokens);
  const cacheReadTokens = cacheRead.every(isCount) ? safeSum(cacheRead) : void 0;
  const cacheWriteTokens = cacheWrite.every(isCount) ? safeSum(cacheWrite) : void 0;
  const reasoningTokens = reasoning2.every(isCount) ? safeSum(reasoning2) : void 0;
  let routes;
  const attributed = attempts.map((attempt) => attempt.route);
  if (attributed.every((route) => route !== void 0)) {
    const unique = /* @__PURE__ */ new Map();
    for (const route of attributed)
      unique.set(`${route.provider}\0${route.model}`, route);
    routes = [...unique.values()];
  }
  return {
    uncachedInputTokens: inputTokens,
    outputTokens,
    totalTokens,
    ...cacheReadTokens === void 0 ? {} : { cacheReadTokens },
    ...cacheWriteTokens === void 0 ? {} : { cacheWriteTokens },
    ...reasoningTokens === void 0 ? {} : { reasoningTokens },
    ...routes === void 0 ? {} : { routes }
  };
}
function sameAttempt(state, turn, step) {
  return state.turn === turn && state.step === step;
}
function deriveTurnTokenUsage(events) {
  let state = { kind: "idle" };
  const attempts = [];
  let turn;
  let sawEnd = false;
  let invalid = false;
  const closeOpen = (route) => {
    if (state.kind !== "open" || state.sample === void 0)
      return false;
    const normalized = normalizeUsage(state.sample, route);
    if (normalized === void 0)
      return false;
    attempts.push(normalized);
    return true;
  };
  for (const event of events) {
    if (invalid)
      break;
    if (event.type === "turn/start") {
      if (turn !== void 0 || state.kind !== "idle")
        invalid = true;
      else
        turn = event.data.turn;
      continue;
    }
    if (turn === void 0) {
      invalid = true;
      break;
    }
    if (event.type === "turn/end") {
      if (event.data.turn !== turn || state.kind !== "idle" || sawEnd)
        invalid = true;
      else
        sawEnd = true;
      continue;
    }
    if (sawEnd) {
      invalid = true;
      break;
    }
    if (event.type === "step/start") {
      if (event.data.turn !== turn || state.kind !== "idle")
        invalid = true;
      else
        state = { kind: "open", turn, step: event.data.step };
      continue;
    }
    if (event.type === "llm/retry-started") {
      if (event.data.turn !== turn || state.kind !== "settled" || state.by !== "retry" || !sameAttempt(state, event.data.turn, event.data.step))
        invalid = true;
      else
        state = { kind: "open", turn, step: event.data.step };
      continue;
    }
    if (event.type === "assistant/attempt") {
      if (event.data.turn !== turn || state.kind !== "open" || !sameAttempt(state, event.data.turn, event.data.step)) {
        invalid = true;
        continue;
      }
      const sample = streamUsage(event.data.stream) ?? state.sample;
      state = { kind: "open", turn, step: event.data.step, ...sample === void 0 ? {} : { sample } };
      if (!closeOpen())
        invalid = true;
      else
        state = { kind: "finishClosed", turn, step: event.data.step };
      continue;
    }
    if (event.type === "assistant/message") {
      if (event.data.turn !== turn || state.kind !== "open" || !sameAttempt(state, event.data.turn, event.data.step)) {
        invalid = true;
        continue;
      }
      const sample = event.data.usage ?? streamUsage(event.data.stream);
      if (sample !== void 0)
        state = { ...state, sample };
      if (!closeOpen(messageRoute(event.data.message)))
        invalid = true;
      else
        state = { kind: "settled", turn, step: event.data.step, by: "message" };
      continue;
    }
    if (event.type === "llm/retry") {
      if (event.data.turn !== turn || state.kind === "idle" || !sameAttempt(state, event.data.turn, event.data.step)) {
        invalid = true;
        continue;
      }
      if (state.kind === "settled" || state.kind === "open" && !closeOpen())
        invalid = true;
      if (!invalid)
        state = { kind: "settled", turn, step: event.data.step, by: "retry" };
      continue;
    }
    if (event.type === "step/end") {
      if (event.data.turn !== turn || state.kind === "idle" || !sameAttempt(state, event.data.turn, event.data.step)) {
        invalid = true;
        continue;
      }
      if (state.kind === "open" && !closeOpen())
        invalid = true;
      if (!invalid)
        state = { kind: "idle" };
    }
  }
  return invalid || !sawEnd || state.kind !== "idle" ? void 0 : aggregateAttempts(attempts);
}

// conversation-nodes/turn-tail.ts
function isSessionEvent(event) {
  return event.type !== "assistant/live-chunk";
}
function turnCoordinates(event) {
  if (event.type === "assistant/message" || event.type === "assistant/attempt" || event.type === "assistant/live-chunk" || event.type === "step/start" || event.type === "step/end") {
    return { turn: event.data.turn, step: event.data.step };
  }
  if (event.type === "llm/retry" || event.type === "llm/retry-started") {
    return { turn: event.data.turn, step: event.data.step };
  }
  return void 0;
}
function turnLocation2(context) {
  const ownTurn = context.state?.turn ?? Number(context.id);
  const location = context.start?.location ?? context.matches.find((match) => (match.location.kind === "turn" || match.location.kind === "step") && match.location.turn.turn === ownTurn)?.location;
  return location?.kind === "turn" || location?.kind === "step" ? location.turn : void 0;
}
function hasText(data) {
  return data.finalNode !== void 0 && data.blocks.some((block) => block.kind === "text" && block.text.trim() !== "");
}
function tailData(context) {
  const end = context.state === void 0 ? context.matches.find((match) => match.event.type === "turn/end") : context.state.end;
  if (end?.event.type !== "turn/end") return null;
  const turn = turnLocation2(context);
  if (turn === void 0) return null;
  const assistants = turn.steps.map((step) => step.data.get("assistant-step")).filter((candidate) => candidate !== void 0);
  const finalized = assistants.filter((candidate) => candidate.finalNode !== void 0).sort((left, right) => left.presentationSeq - right.presentationSeq);
  const proof = phaseFromMatches(context.matches);
  const story = roleplayStory(turn, proof);
  const closing = proof === void 0 ? finalized.findLast(hasText) ?? null : story;
  let latestTranscriptSeq = finalized.at(-1)?.presentationSeq;
  for (const match of context.matches) {
    const event = match.event;
    const candidate = event.type === "tool/call" || event.type === "tool/result" && event.surfaceOp === "append" || event.type === "turn/end" && event.data.reason.kind === "error" || event.type === "llm/retry" ? event.seq : void 0;
    if (candidate !== void 0 && (latestTranscriptSeq === void 0 || candidate > latestTranscriptSeq)) {
      latestTranscriptSeq = candidate;
    }
  }
  if (story !== null) latestTranscriptSeq = story.presentationSeq;
  const tokenUsage = context.start?.event.type === "turn/start" ? deriveTurnTokenUsage(context.matches.map((match) => match.event).filter(isSessionEvent)) : void 0;
  return {
    turn: end.event.data.turn,
    seq: end.event.seq,
    time: end.event.time,
    closing,
    branchUnavailable: closing === null || latestTranscriptSeq !== closing.presentationSeq,
    ...tokenUsage === void 0 ? {} : { tokenUsage }
  };
}
var turnTailDefinition = {
  kind: "turn-tail",
  target: "chat",
  match: (event) => {
    if (event.type === "turn/start") return { id: String(event.data.turn), role: "start" };
    if (event.type === "turn/end") return { id: String(event.data.turn), role: "update" };
    const phase = roleplayPhase(event);
    if (phase !== void 0) return { id: String(phase.turn), role: "update" };
    if (event.type === "tool/call" || event.type === "tool/result") {
      return { id: String(event.data.turn), role: "update" };
    }
    const coordinates = turnCoordinates(event);
    if (coordinates !== void 0) return { id: String(coordinates.turn), role: "update" };
    return null;
  },
  start: (_context, match) => {
    if (match.event.type !== "turn/start") throw new Error("turn-tail start requires turn/start");
    return { turn: match.event.data.turn };
  },
  update: (context, match) => match.event.type === "turn/end" ? { ...context.state, end: match } : context.state,
  publication: (match) => match.event.type === "turn/end" ? "immediate" : "none",
  buildLocationData: (context, scope) => {
    if (scope !== "turn") return null;
    const value = tailData(context);
    return value === null ? null : {
      kind: "turn",
      turn: value.turn,
      key: "turn-tail",
      value
    };
  },
  buildViewNode: (context) => {
    const turn = turnLocation2(context);
    const data = turn?.data.get("turn-tail");
    return data === void 0 ? null : chatNode(context, "turn-tail", data.seq + CHAT_SYNTHETIC_SEQ_OFFSETS.finalizedFollowup, data);
  }
};
function registerTurnTailConversationNode(ctx) {
  ctx.uiConversation.events.register(turnTailDefinition);
}

// conversation-nodes/process-activity.ts
function activity(name) {
  if (["read", "read_image", "list_mcp_resources", "list_mcp_resource_templates", "read_mcp_resource"].includes(name)) return "read";
  if (name === "grep" || name === "glob" || name.endsWith("_inspect")) return "search";
  if (["write", "edit", "apply_patch"].includes(name)) return "edit";
  if (["bash", "pwsh", "exec_command", "write_stdin"].includes(name) || name.startsWith("terminal_")) return "commands";
  if (name === "run_code") return "code";
  if (name === "web_search") return "webSearch";
  if (name === "web_fetch") return "webFetch";
  if (name === "subagent" || name.startsWith("subagent_")) return "subagents";
  if (["todo_write", "create_goal", "update_goal", "get_goal"].includes(name)) return "plan";
  if (name === "ask_user_question" || name === "request_user_input") return "questions";
  return "tools";
}
var LIVE_TOOL_DETAIL_MAX_CHARS = 160;
var LIVE_TOOL_DETAIL_SEGMENTER = new Intl.Segmenter(void 0, { granularity: "grapheme" });
var LIVE_TOOL_DETAIL_KEYS = [
  "title",
  "description",
  "objective",
  "task",
  "task_name",
  "name",
  "question",
  "questions",
  "prompt",
  "message",
  "command",
  "cmd",
  "queries",
  "query",
  "pattern",
  "url",
  "uri",
  "file_path",
  "path",
  "target",
  "action",
  "status"
];
function normalizeLiveToolDetail(value) {
  const text = typeof value === "string" ? value : Array.isArray(value) && value.every((item) => typeof item === "string") ? value.join(", ") : "";
  const normalized = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(LIVE_TOOL_DETAIL_SEGMENTER.segment(normalized), (part) => part.segment);
  return chars.length <= LIVE_TOOL_DETAIL_MAX_CHARS ? normalized : `${chars.slice(0, LIVE_TOOL_DETAIL_MAX_CHARS - 1).join("").trimEnd()}\u2026`;
}
function questionDetail(value) {
  if (!Array.isArray(value)) return "";
  for (const item of value) {
    if (item === null || typeof item !== "object") continue;
    const detail = normalizeLiveToolDetail(Reflect.get(item, "question"));
    if (detail !== "") return detail;
  }
  return "";
}
function liveReasoningDetail(nodes) {
  for (let nodeIndex = nodes.length - 1; nodeIndex >= 0; nodeIndex--) {
    const node = nodes[nodeIndex];
    if (node?.kind !== "assistant-step" || node.data.status !== "running") continue;
    for (let blockIndex = node.data.blocks.length - 1; blockIndex >= 0; blockIndex--) {
      const block = node.data.blocks[blockIndex];
      if (block?.kind !== "reasoning") continue;
      const paragraphs = block.text.split(/\r?\n[\t ]*\r?\n/);
      for (let paragraphIndex = paragraphs.length - 1; paragraphIndex >= 0; paragraphIndex--) {
        const detail = normalizeLiveToolDetail(paragraphs[paragraphIndex]?.replaceAll("**", ""));
        if (detail !== "") return detail;
      }
    }
  }
  return "";
}
function liveToolDetail(name, argsRaw) {
  let args;
  try {
    args = JSON.parse(argsRaw);
  } catch (_error) {
    return normalizeLiveToolDetail(name);
  }
  if (args === null || typeof args !== "object") return normalizeLiveToolDetail(name);
  for (const key19 of LIVE_TOOL_DETAIL_KEYS) {
    if (key19 in args) {
      const value = Reflect.get(args, key19);
      const detail = key19 === "questions" ? questionDetail(value) : normalizeLiveToolDetail(value);
      if (detail !== "") return detail;
    }
  }
  return normalizeLiveToolDetail(name);
}
function processActivity(nodes) {
  const counts = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Set();
  let running;
  let runningDetail = "";
  let runningTime = -Infinity;
  const visit = (tool) => {
    if (seen.has(tool.callId)) return;
    seen.add(tool.callId);
    const call = isRunningTool(tool) ? tool : tool.call;
    if (call !== null) {
      const kind = activity(call.name);
      if (isRunningTool(tool) && tool.time >= runningTime) {
        running = kind;
        runningDetail = liveToolDetail(tool.name, tool.argsRaw);
        runningTime = tool.time;
      }
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
    }
    for (const child of tool.subCalls) visit(child);
  };
  for (const node of nodes) {
    if (node.kind === "tool-call") visit(node.data.root);
  }
  if (running === void 0) runningDetail = liveReasoningDetail(nodes);
  return {
    counts: [...counts].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    running,
    runningDetail
  };
}

// conversation-nodes/process-groups.ts
var INDEPENDENT = /* @__PURE__ */ new Set(["user", "steering", "turn-trigger", "model-retry", "turn-error", "turn-max-tokens", "turn-tail"]);
function turnOf2(node) {
  const location = node.location;
  return location.kind === "turn" || location.kind === "step" ? location.turn.turn : void 0;
}
function reasoning(node) {
  return node.kind === "assistant-step" && node.data.blocks.some((block) => block.kind === "reasoning" && block.text.trim() !== "");
}
function reply(node) {
  return node.kind === "assistant-step" && hasAssistantReplyContent(node.data.blocks);
}
function sameSummary(left, right) {
  return left.running === right.running && left.runningDetail === right.runningDetail && left.counts.length === right.counts.length && left.counts.every((value, index) => value.kind === right.counts[index]?.kind && value.count === right.counts[index].count);
}
function sameMembers(left, right) {
  return left.length === right.length && left.every((value, index) => value.key === right[index]?.key && value.groupPart === right[index].groupPart);
}
function structureChanged(previous, current) {
  if (!isVisibleChatNode(current) && (previous === void 0 || !isVisibleChatNode(previous))) return false;
  return previous === void 0 || previous.kind !== current.kind || turnOf2(previous) !== turnOf2(current) || isVisibleChatNode(previous) !== isVisibleChatNode(current) || reasoning(previous) !== reasoning(current) || reply(previous) !== reply(current);
}
function readNode(input, key19) {
  const node = input.readNode(key19);
  if (node === void 0) throw new Error(`Chat grouping input is missing Node ${key19}`);
  return node;
}
var ProcessGroup = class {
  constructor(key19, turn, members) {
    this.key = key19;
    this.turn = turn;
    this.members = members;
    this.snapshot = { key: key19, members, data: { turn, closed: false, summary: { counts: [], running: void 0, runningDetail: "" } } };
  }
  nodes = [];
  snapshot;
  refresh(input, closed) {
    const nodes = this.members.map((member) => readNode(input, member.key));
    const unchanged = nodes.length === this.nodes.length && nodes.every((node, index) => node === this.nodes[index]);
    const previous = this.snapshot.data;
    const activity2 = unchanged && previous.closed === closed ? previous.summary : processActivity(nodes);
    const summary = closed ? { ...activity2, running: void 0, runningDetail: "" } : activity2;
    this.nodes = nodes;
    if (previous.closed !== closed || !sameSummary(previous.summary, summary)) {
      this.snapshot = {
        key: this.key,
        members: this.members,
        data: { turn: this.turn, closed, summary }
      };
    }
  }
};
var TurnGroups = class {
  constructor(turn) {
    this.turn = turn;
  }
  groups = /* @__PURE__ */ new Map();
  membership = /* @__PURE__ */ new Map();
  roots = /* @__PURE__ */ new Map();
  references(key19) {
    return this.roots.get(key19) ?? [];
  }
  snapshots() {
    return [...this.groups.values()].map((group) => group.snapshot);
  }
  refresh(input, changed) {
    const dirty = /* @__PURE__ */ new Set();
    for (const node of changed) {
      const group = this.membership.get(node);
      if (group !== void 0) dirty.add(group);
    }
    const ended = input.timeline.turns.get(this.turn)?.status === "closed";
    if (ended) {
      for (const group of this.groups.values()) {
        if (!group.snapshot.data.closed) dirty.add(group.key);
      }
    }
    const upserts = [];
    for (const key19 of dirty) {
      const group = this.groups.get(key19);
      const previous = group.snapshot;
      group.refresh(input, previous.data.closed || ended);
      if (group.snapshot !== previous) upserts.push(group.snapshot);
    }
    return upserts;
  }
  rebuild(input, added) {
    const roots = /* @__PURE__ */ new Map();
    const groups = /* @__PURE__ */ new Map();
    const membership = /* @__PURE__ */ new Map();
    let pending = [];
    const upserts = [];
    const emit = (key19, entry) => {
      roots.set(key19, [...roots.get(key19) ?? [], entry]);
    };
    const flush = (closed) => {
      const first = pending[0];
      if (first === void 0) return;
      const retained = this.extendedGroup(pending, added);
      const key19 = retained?.key ?? brandString(JSON.stringify(["process", first.key, first.groupPart ?? null]));
      const previous2 = this.groups.get(key19);
      const before = previous2?.snapshot;
      const group = previous2 !== void 0 && sameMembers(previous2.members, pending) ? previous2 : new ProcessGroup(key19, this.turn, pending);
      group.refresh(input, closed || input.timeline.turns.get(this.turn)?.status === "closed");
      groups.set(group.key, group);
      emit(first.key, { kind: "group", key: group.key });
      for (const member of pending) membership.set(member.key, group.key);
      if (group.snapshot !== before) upserts.push(group.snapshot);
      pending = [];
    };
    let previous;
    let followed = false;
    for (const key19 of input.readTurn(this.turn)) {
      const position = readPosition(input, key19);
      if (previous !== void 0 && position.previous !== previous) flush(true);
      previous = key19;
      followed = position.next !== void 0;
      const node = readNode(input, key19);
      if (INDEPENDENT.has(node.kind)) {
        flush(true);
        emit(key19, { kind: "node", key: key19 });
      } else if (node.kind === "turn-process") {
        emit(key19, { kind: "node", key: key19 });
      } else if (node.kind === "assistant-step") {
        if (reasoning(node)) pending.push({ kind: "node", key: key19, groupPart: "reasoning" });
        if (reply(node)) {
          flush(true);
          emit(key19, { kind: "node", key: key19, groupPart: "response" });
        }
      } else pending.push({ kind: "node", key: key19 });
    }
    flush(followed);
    const removes = [...this.groups.keys()].filter((key19) => !groups.has(key19));
    this.groups = groups;
    this.membership = membership;
    this.roots = roots;
    return { upserts, removes };
  }
  extendedGroup(members, added) {
    const offset = members.findIndex((member) => !added.has(member.key));
    const first = members[offset];
    if (first === void 0) return void 0;
    const key19 = this.membership.get(first.key);
    const previous = key19 === void 0 ? void 0 : this.groups.get(key19);
    if (previous === void 0 || offset + previous.members.length > members.length) return void 0;
    for (let index = 0; index < previous.members.length; index++) {
      const before = previous.members[index];
      const after = members[offset + index];
      if (before.key !== after.key || before.groupPart !== after.groupPart) return void 0;
    }
    for (let index = offset + previous.members.length; index < members.length; index++) {
      if (!added.has(members[index].key)) return void 0;
    }
    return previous;
  }
};
function readPosition(input, key19) {
  const position = input.readPosition(key19);
  if (position === void 0) throw new Error(`Chat grouping order is missing position for Node ${key19}`);
  return position;
}
var ProcessState = class {
  turns = /* @__PURE__ */ new Map();
  order = [];
  pending = null;
  /**
   * Consume one synchronous Builder input without retaining its readers.
   * @param input - projected Node changes, indexed positions, and Turn lifecycle.
   */
  accept(input) {
    if (input.kind === "replace") {
      const previousKeys = new Set(this.order);
      const added2 = new Set(input.order.filter((key19) => !previousKeys.has(key19)));
      const turns = /* @__PURE__ */ new Map();
      for (const key19 of input.order) {
        const turn = readPosition(input, key19).turn;
        if (turn === void 0 || turns.has(turn)) continue;
        const groups = this.turns.get(turn) ?? new TurnGroups(turn);
        groups.rebuild(input, added2);
        turns.set(turn, groups);
      }
      this.turns = turns;
      this.order = input.order;
      this.pending = {
        entries: this.rootEntries(input),
        groups: { kind: "replace", snapshots: [...turns.values()].flatMap((turn) => turn.snapshots()) }
      };
      return;
    }
    const regroup = new Set(input.changedTurnOrders);
    const added = /* @__PURE__ */ new Set();
    const changed = /* @__PURE__ */ new Map();
    const touch = (turn) => {
      let keys = changed.get(turn);
      if (keys === void 0) {
        keys = /* @__PURE__ */ new Set();
        changed.set(turn, keys);
      }
      return keys;
    };
    for (const change of input.changes) {
      const before = change.previous;
      const after = change.current;
      const turn = turnOf2(after);
      if (before === void 0 || !isVisibleChatNode(before)) added.add(after.key);
      if (structureChanged(before, after)) {
        const previousTurn = before === void 0 ? void 0 : turnOf2(before);
        if (previousTurn !== void 0) regroup.add(previousTurn);
        if (turn !== void 0) regroup.add(turn);
      }
      if (turn !== void 0) touch(turn).add(after.key);
    }
    for (const turn of input.changedTurns) touch(turn);
    const upserts = [];
    const removes = [];
    for (const turn of regroup) {
      const groups = this.turns.get(turn) ?? new TurnGroups(turn);
      const update = groups.rebuild(input, added);
      upserts.push(...update.upserts);
      removes.push(...update.removes);
      if (input.readTurn(turn).length === 0) this.turns.delete(turn);
      else this.turns.set(turn, groups);
    }
    for (const [turn, keys] of changed) {
      if (!regroup.has(turn)) upserts.push(...this.turns.get(turn)?.refresh(input, keys) ?? []);
    }
    const reordered = input.order !== this.order || regroup.size > 0;
    this.order = input.order;
    const installed = new Set(upserts.map((group) => group.key));
    this.pending = reordered || upserts.length > 0 || removes.length > 0 ? {
      ...reordered ? { entries: this.rootEntries(input) } : {},
      groups: { kind: "apply", upserts, removes: removes.filter((key19) => !installed.has(key19)) }
    } : null;
  }
  rootEntries(input) {
    return input.order.flatMap((key19) => {
      const turn = readPosition(input, key19).turn;
      if (turn === void 0) return [{ kind: "node", key: key19 }];
      const groups = this.turns.get(turn);
      if (groups === void 0) throw new Error(`Chat grouping order is missing Turn ${turn}`);
      return groups.references(key19);
    });
  }
  /**
   * Read pending output without advancing State.
   * @returns the repeatable update for the last input batch.
   */
  output() {
    return this.pending;
  }
};
var processGroupDefinition = {
  kind: "process-groups",
  target: "chat",
  create: () => new ProcessState(),
  update: (context, input) => {
    context.state.accept(input);
    return context.state;
  },
  buildGroups: (context) => context.state.output()
};

// conversation-nodes/register.ts
function registerConversationNodes(ctx) {
  registerInboxConversationNodes(ctx);
  registerMessageConversationNode(ctx);
  registerMessageEdits(ctx);
  registerRequestPromptConversationNode(ctx);
  registerAssistantConversationNode(ctx);
  registerTurnProcess(ctx);
  registerToolConversationNode(ctx);
  registerCommandConversationNode(ctx);
  registerCompactionConversationNode(ctx);
  registerRetryConversationNode(ctx);
  registerTurnErrorConversationNode(ctx);
  registerTurnMaxTokensConversationNode(ctx);
  registerTurnTailConversationNode(ctx);
  registerUnknownConversationFallback(ctx);
  registerChatConversationView(ctx);
  ctx.uiConversation.groups.register(processGroupDefinition);
}

// ../../../../build-tools/node_modules/@deepseek-ai/cosmokit/lib/index.js
function isNullable(value) {
  return value === null || value === void 0;
}
function isPlainObject(data) {
  return data && typeof data === "object" && !Array.isArray(data);
}
function filterKeys(object, filter) {
  return Object.fromEntries(Object.entries(object).filter(([key19, value]) => filter(key19, value)));
}
function mapValues(object, transform) {
  return Object.fromEntries(Object.entries(object).map(([key19, value]) => [key19, transform(value, key19)]));
}
function pick(source, keys, forced) {
  if (!keys) return { ...source };
  const result = {};
  for (const key19 of keys) if (forced || source[key19] !== void 0) result[key19] = source[key19];
  return result;
}
var write = Symbol.for("cosmokit.volatile.write");
function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
  if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
  if (value === null || typeof value !== "object") return value;
  if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key19, item]) => [key19, snapshot(item, ancestors)])));
  } finally {
    ancestors.delete(value);
  }
}
function createVolatile(value) {
  let current = snapshot(value);
  return Object.freeze({
    get: () => current,
    [write]: (value2) => {
      current = value2;
    }
  });
}
function isVolatile(value) {
  return typeof value === "object" && value !== null && write in value;
}
function is(type, value) {
  if (arguments.length === 1) return (value2) => is(type, value2);
  return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
  return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
  return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
var Binary;
(function(Binary2) {
  Binary2.is = isArrayBufferLike;
  Binary2.isSource = isArrayBufferSource;
  function fromSource(source) {
    if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    else return source;
  }
  Binary2.fromSource = fromSource;
  function toBase64(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
    let binary = "";
    const bytes = new Uint8Array(source);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  Binary2.toBase64 = toBase64;
  function fromBase64(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
    return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  }
  Binary2.fromBase64 = fromBase64;
  function toHex(source) {
    source = fromSource(source);
    if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
    return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  Binary2.toHex = toHex;
  function fromHex(source) {
    if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
    const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
    const buffer = [];
    for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
    return Uint8Array.from(buffer).buffer;
  }
  Binary2.fromHex = fromHex;
})(Binary || (Binary = {}));
var base64ToArrayBuffer = Binary.fromBase64;
var arrayBufferToBase64 = Binary.toBase64;
var hexToArrayBuffer = Binary.fromHex;
var arrayBufferToHex = Binary.toHex;
function clone(source, refs = /* @__PURE__ */ new Map()) {
  if (!source || typeof source !== "object") return source;
  if (is("Date", source)) return new Date(source.valueOf());
  if (is("RegExp", source)) return new RegExp(source.source, source.flags);
  if (isArrayBufferLike(source)) return source.slice(0);
  if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const cached = refs.get(source);
  if (cached) return cached;
  if (Array.isArray(source)) {
    const result2 = [];
    refs.set(source, result2);
    source.forEach((value, index) => {
      result2[index] = Reflect.apply(clone, null, [value, refs]);
    });
    return result2;
  }
  const result = Object.create(Object.getPrototypeOf(source));
  refs.set(source, result);
  for (const key19 of Reflect.ownKeys(source)) {
    const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key19) };
    if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
    Reflect.defineProperty(result, key19, descriptor);
  }
  return result;
}
function deepEqual(a, b, strict) {
  const ancestors = /* @__PURE__ */ new Set();
  function compare(a2, b2) {
    if (a2 === b2) return true;
    if (isVolatile(a2) || isVolatile(b2)) return isVolatile(a2) && isVolatile(b2);
    if (!strict && isNullable(a2) && isNullable(b2)) return true;
    if (typeof a2 !== typeof b2 || typeof a2 !== "object" || !a2 || !b2) return false;
    if (ancestors.has(a2)) return false;
    function check(test, then) {
      return test(a2) ? test(b2) ? then(a2, b2) : false : test(b2) ? false : void 0;
    }
    ancestors.add(a2);
    try {
      return check(Array.isArray, (a3, b3) => {
        if (a3.length !== b3.length) return false;
        for (let index = 0; index < a3.length; index++) if (!compare(a3[index], b3[index])) return false;
        return true;
      }) ?? check(is("Date"), (a3, b3) => a3.valueOf() === b3.valueOf()) ?? check(is("URL"), (a3, b3) => a3.href === b3.href) ?? check(is("RegExp"), (a3, b3) => a3.source === b3.source && a3.flags === b3.flags) ?? check(isArrayBufferLike, (a3, b3) => {
        if (a3.byteLength !== b3.byteLength) return false;
        const viewA = new Uint8Array(a3);
        const viewB = new Uint8Array(b3);
        for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
        return true;
      }) ?? ((!strict || [a2, b2].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
        ...a2,
        ...b2
      }).every((key19) => compare(a2[key19], b2[key19])));
    } finally {
      ancestors.delete(a2);
    }
  }
  return compare(a, b);
}
var Time;
(function(Time2) {
  Time2.millisecond = 1;
  Time2.second = 1e3;
  Time2.minute = Time2.second * 60;
  Time2.hour = Time2.minute * 60;
  Time2.day = Time2.hour * 24;
  Time2.week = Time2.day * 7;
  let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
  function setTimezoneOffset(offset) {
    timezoneOffset = offset;
  }
  Time2.setTimezoneOffset = setTimezoneOffset;
  function getTimezoneOffset() {
    return timezoneOffset;
  }
  Time2.getTimezoneOffset = getTimezoneOffset;
  function getDateNumber(date2 = /* @__PURE__ */ new Date(), offset) {
    if (typeof date2 === "number") date2 = new Date(date2);
    if (offset === void 0) offset = timezoneOffset;
    return Math.floor((date2.valueOf() / Time2.minute - offset) / 1440);
  }
  Time2.getDateNumber = getDateNumber;
  function fromDateNumber(value, offset) {
    const date2 = new Date(value * Time2.day);
    if (offset === void 0) offset = timezoneOffset;
    return new Date(+date2 + offset * Time2.minute);
  }
  Time2.fromDateNumber = fromDateNumber;
  const numeric = /\d+(?:\.\d+)?/.source;
  const timeRegExp = new RegExp(`^${[
    "w(?:eek(?:s)?)?",
    "d(?:ay(?:s)?)?",
    "h(?:our(?:s)?)?",
    "m(?:in(?:ute)?(?:s)?)?",
    "s(?:ec(?:ond)?(?:s)?)?"
  ].map((unit) => `(${numeric}${unit})?`).join("")}$`);
  function parseTime(source) {
    const capture = timeRegExp.exec(source);
    if (!capture) return 0;
    return (parseFloat(capture[1]) * Time2.week || 0) + (parseFloat(capture[2]) * Time2.day || 0) + (parseFloat(capture[3]) * Time2.hour || 0) + (parseFloat(capture[4]) * Time2.minute || 0) + (parseFloat(capture[5]) * Time2.second || 0);
  }
  Time2.parseTime = parseTime;
  function parseDate(date2) {
    const parsed = parseTime(date2);
    if (parsed) date2 = Date.now() + parsed;
    else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date2}`;
    else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date2)) date2 = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date2}`;
    return date2 ? new Date(date2) : /* @__PURE__ */ new Date();
  }
  Time2.parseDate = parseDate;
  function format(ms) {
    const abs = Math.abs(ms);
    if (abs >= Time2.day - Time2.hour / 2) return Math.round(ms / Time2.day) + "d";
    else if (abs >= Time2.hour - Time2.minute / 2) return Math.round(ms / Time2.hour) + "h";
    else if (abs >= Time2.minute - Time2.second / 2) return Math.round(ms / Time2.minute) + "m";
    else if (abs >= Time2.second) return Math.round(ms / Time2.second) + "s";
    return ms + "ms";
  }
  Time2.format = format;
  function toDigits(source, length = 2) {
    return source.toString().padStart(length, "0");
  }
  Time2.toDigits = toDigits;
  function template(template2, time = /* @__PURE__ */ new Date()) {
    return template2.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
  }
  Time2.template = template;
})(Time || (Time = {}));

// ../../../../build-tools/node_modules/@deepseek-ai/schemastery/lib/index.mjs
var kSchema = Symbol.for("schemastery");
var kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
  options;
  name = "ValidationError";
  constructor(message, options) {
    let prefix = "$";
    for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
    else if (typeof segment === "number") prefix += "[" + segment + "]";
    else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
    if (prefix.startsWith(".")) prefix = prefix.slice(1);
    super((prefix === "$" ? "" : `${prefix} `) + message);
    this.options = options;
  }
  static is(error) {
    return !!error?.[kValidationError];
  }
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
var Schema = function(options) {
  const schema = function(data, options2 = {}) {
    return Schema.resolve(data, schema, options2)[0];
  };
  if (options.refs) {
    const refs = mapValues(options.refs, (options2) => new Schema(options2));
    const getRef = (uid) => refs[uid];
    for (const key19 in refs) {
      const options2 = refs[key19];
      options2.sKey = getRef(options2.sKey);
      options2.inner = getRef(options2.inner);
      options2.list = options2.list && options2.list.map(getRef);
      options2.dict = options2.dict && mapValues(options2.dict, getRef);
    }
    return refs[options.uid];
  }
  Object.assign(schema, options);
  if (typeof schema.callback === "string") try {
    schema.callback = new Function("return " + schema.callback)();
  } catch {
  }
  Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
  Object.setPrototypeOf(schema, Schema.prototype);
  schema.meta ||= {};
  schema.toString = schema.toString.bind(schema);
  return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
  return {
    version: 1,
    vendor: "schemastery",
    validate: (value) => {
      try {
        return { value: Schema.resolve(value, this, {})[0] };
      } catch (error) {
        if (ValidationError.is(error)) return { issues: [{
          message: error.message,
          path: error.options.path
        }] };
        throw error;
      }
    }
  };
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
  if (globalThis.__schemastery_refs__) {
    globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
    return this.uid;
  }
  globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
  globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
  const result = {
    uid: this.uid,
    refs: globalThis.__schemastery_refs__
  };
  globalThis.__schemastery_refs__ = void 0;
  return result;
};
Schema.prototype.set = function set(key19, value) {
  this.dict[key19] = value;
  return this;
};
Schema.prototype.push = function push(value) {
  this.list.push(value);
  return this;
};
function mergeDesc(original, messages) {
  const result = typeof original === "string" ? { "": original } : { ...original };
  for (const locale in messages) {
    const value = messages[locale];
    if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
    else if (typeof value === "string") result[locale] = value;
  }
  return result;
}
function getInner(value) {
  return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
  return filterKeys(data ?? {}, (key19) => !key19.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
  const schema = Schema(this);
  const desc = mergeDesc(schema.meta.description, messages);
  if (Object.keys(desc).length) schema.meta.description = desc;
  if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key19) => {
    return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key19] ?? data?.[key19]));
  });
  if (schema.list) schema.list = schema.list.map((inner, index) => {
    return inner.i18n(mapValues(messages, (data = {}) => {
      if (Array.isArray(getInner(data))) return getInner(data)[index];
      if (Array.isArray(data)) return data[index];
      return extractKeys(data);
    }));
  });
  if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
    if (getInner(data)) return getInner(data);
    return extractKeys(data);
  }));
  if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
  return schema;
};
Schema.prototype.extra = function extra(key19, value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key19]: value
  };
  return schema;
};
for (const key19 of [
  "required",
  "disabled",
  "collapse",
  "hidden",
  "loose"
]) Object.assign(Schema.prototype, { [key19](value = true) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key19]: value
  };
  return schema;
} });
Schema.prototype.deprecated = function deprecated() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "deprecated",
    type: "danger"
  });
  return schema;
};
Schema.prototype.experimental = function experimental() {
  const schema = Schema(this);
  schema.meta.badges ||= [];
  schema.meta.badges.push({
    text: "experimental",
    type: "warning"
  });
  return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
  const schema = Schema(this);
  const pattern2 = pick(regexp, ["source", "flags"]);
  schema.meta = {
    ...schema.meta,
    pattern: pattern2
  };
  return schema;
};
Schema.prototype.simplify = function simplify(value) {
  if (isVolatile(value)) value = value.get();
  if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
  if (isNullable(value)) return value;
  if (this.type === "object" || this.type === "dict") {
    const result = {};
    for (const key19 in value) {
      const item = (this.type === "object" ? this.dict[key19] : this.inner)?.simplify(value[key19]);
      if (this.type === "dict" || !isNullable(item)) result[key19] = item;
    }
    if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
    return result;
  } else if (this.type === "array" || this.type === "tuple") {
    const result = [];
    value.forEach((value2, index) => {
      const schema = this.type === "array" ? this.inner : this.list[index];
      const item = schema ? schema.simplify(value2) : value2;
      result.push(item);
    });
    return result;
  } else if (this.type === "intersect") {
    const result = {};
    for (const item of this.list) Object.assign(result, item.simplify(value));
    return result;
  } else if (this.type === "union") for (const schema of this.list) try {
    Schema.resolve(value, schema, {});
    return schema.simplify(value);
  } catch {
  }
  return value;
};
Schema.prototype.toString = function toString(inline) {
  return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra2) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    role,
    extra: extra2
  };
  return schema;
};
for (const key19 of [
  "default",
  "link",
  "comment",
  "description",
  "max",
  "min",
  "step"
]) Object.assign(Schema.prototype, { [key19](value) {
  const schema = Schema(this);
  schema.meta = {
    ...schema.meta,
    [key19]: value
  };
  return schema;
} });
Schema.prototype.volatile = function volatile() {
  if (this.meta.volatile) throw new TypeError("volatile schema is already wrapped");
  return this.extra("volatile", true);
};
var resolvers = {};
var checkedVolatile = Symbol("checked-volatile-schema");
function validateVolatileSchema(schema, path = [], blocked = false, seen = /* @__PURE__ */ new Map()) {
  const states = seen.get(schema) ?? /* @__PURE__ */ new Set();
  if (states.has(blocked)) return;
  states.add(blocked);
  seen.set(schema, states);
  if (schema.meta?.volatile && blocked) throw new ValidationError("volatile fields require a fixed object path without an enclosing volatile field", { path });
  const nested = blocked || !!schema.meta?.volatile;
  if (schema.dict) for (const [key19, child] of Object.entries(schema.dict)) validateVolatileSchema(child, [...path, key19], nested, seen);
  if (schema.sKey) validateVolatileSchema(schema.sKey, [...path, "<key>"], true, seen);
  if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema])) validateVolatileSchema(schema.inner, [...path, "*"], true, seen);
  if (schema.list) for (let index = 0; index < schema.list.length; index++) validateVolatileSchema(schema.list[index], [...path, String(index)], true, seen);
}
Schema.extend = function extend(type, resolve2) {
  resolvers[type] = resolve2;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
  if (!schema) return [data];
  if (!options[checkedVolatile]) {
    validateVolatileSchema(schema, options.path);
    options = {
      ...options,
      [checkedVolatile]: true
    };
  }
  if (schema.meta?.volatile) {
    const inner = Schema(schema);
    inner.meta = {
      ...schema.meta,
      volatile: false
    };
    const [value, adapted] = Schema.resolve(data, inner, options, strict);
    try {
      return [createVolatile(value), adapted];
    } catch (error) {
      throw new ValidationError(error instanceof Error ? error.message : String(error), options);
    }
  }
  if (options.ignore?.(data, schema)) return [data];
  if (isNullable(data) && schema.type !== "lazy") {
    if (schema.meta.required) throw new ValidationError(`missing required value`, options);
    let current = schema;
    let fallback = schema.meta.default;
    while (current?.type === "intersect" && isNullable(fallback)) {
      current = current.list[0];
      fallback = current?.meta.default;
    }
    if (isNullable(fallback)) return [data];
    data = clone(fallback);
  }
  const callback = resolvers[schema.type];
  if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
  try {
    return callback(data, schema, options, strict);
  } catch (error) {
    if (!schema.meta.loose) throw error;
    return [schema.meta.default];
  }
};
Schema.from = function from(source) {
  if (isNullable(source)) return Schema.any();
  else if ([
    "string",
    "number",
    "boolean"
  ].includes(typeof source)) return Schema.const(source).required();
  else if (source[kSchema]) return source;
  else if (typeof source === "function") switch (source) {
    case String:
      return Schema.string().required();
    case Number:
      return Schema.number().required();
    case Boolean:
      return Schema.boolean().required();
    case Function:
      return Schema.function().required();
    default:
      return Schema.is(source).required();
  }
  else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
  const toJSON2 = () => {
    if (!schema.inner[kSchema]) {
      schema.inner = schema.builder();
      schema.inner.meta = {
        ...schema.meta,
        ...schema.inner.meta
      };
    }
    return schema.inner.toJSON();
  };
  const schema = new Schema({
    type: "lazy",
    builder,
    inner: { toJSON: toJSON2 }
  });
  return schema;
};
Schema.natural = function natural() {
  return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
  return Schema.number().step(0.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
  return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
    const date2 = new Date(value);
    if (isNaN(+date2)) throw new ValidationError(`invalid date "${value}"`, options);
    return date2;
  }, true)]);
};
Schema.regExp = function regExp(flag = "") {
  return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
    try {
      return new RegExp(value, flag);
    } catch (e) {
      throw new ValidationError(e.message, options);
    }
  }, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
  return Schema.union([
    Schema.is(ArrayBuffer),
    Schema.is(SharedArrayBuffer),
    Schema.transform(Schema.any(), (value, options) => {
      if (Binary.isSource(value)) return Binary.fromSource(value);
      throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
    }, true),
    ...encoding ? [Schema.transform(Schema.string(), (value, options) => {
      try {
        return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
      } catch (e) {
        throw new ValidationError(e.message, options);
      }
    }, true)] : []
  ]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
  if (!schema.inner[kSchema]) {
    schema.inner = schema.builder();
    schema.inner.meta = {
      ...schema.meta,
      ...schema.inner.meta
    };
    validateVolatileSchema(schema.inner, options.path, true);
  }
  return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
  return [data];
});
Schema.extend("never", (data, _, options) => {
  throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
  if (deepEqual(data, value)) return [value];
  throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
  const { max = Infinity, min = -Infinity } = meta;
  if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
  if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
  if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
  if (meta.pattern) {
    const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
    if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
  }
  checkWithinRange(data.length, meta, "string length", options);
  return [data];
});
function decimalShift(data, digits) {
  const str = data.toString();
  if (str.includes("e")) return data * Math.pow(10, digits);
  const index = str.indexOf(".");
  if (index === -1) return data * Math.pow(10, digits);
  const frac = str.slice(index + 1);
  const integer = str.slice(0, index);
  if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
  return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
  step = Math.abs(step);
  if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
  const index = step.toString().indexOf(".");
  const digits = step.toString().slice(index + 1).length;
  return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
  if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
  checkWithinRange(data, meta, "number", options);
  const { step } = meta;
  if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
  return [data];
});
Schema.extend("boolean", (data, _, options) => {
  if (typeof data === "boolean") return [data];
  throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
  let value = 0, keys = [];
  if (typeof data === "number") {
    value = data;
    for (const key19 in bits) if (data & bits[key19]) keys.push(key19);
  } else if (Array.isArray(data)) {
    keys = data;
    for (const key19 of keys) {
      if (typeof key19 !== "string") throw new ValidationError(`expected string but got ${key19}`, options);
      if (key19 in bits) value |= bits[key19];
    }
  } else throw new ValidationError(`expected number or array but got ${data}`, options);
  if (value === meta.default) return [value];
  return [value, keys];
});
Schema.extend("function", (data, _, options) => {
  if (typeof data === "function") return [data];
  throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
  if (typeof constructor === "function") {
    if (data instanceof constructor) return [data];
    throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
  } else {
    if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
    let prototype = Object.getPrototypeOf(data);
    while (prototype) {
      if (prototype.constructor?.name === constructor) return [data];
      prototype = Object.getPrototypeOf(prototype);
    }
    throw new ValidationError(`expected ${constructor} but got ${data}`, options);
  }
});
function property(data, key19, schema, options) {
  try {
    const [value, adapted] = Schema.resolve(data[key19], schema, {
      ...options,
      path: [...options.path || [], key19]
    });
    if (adapted !== void 0) data[key19] = adapted;
    return value;
  } catch (e) {
    if (!options?.autofix) throw e;
    delete data[key19];
    return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
  }
}
Schema.extend("array", (data, { inner, meta }, options) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
  return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key19 in data) {
    let rKey;
    try {
      rKey = Schema.resolve(key19, sKey, options)[0];
    } catch (error) {
      if (strict) continue;
      throw error;
    }
    result[rKey] = property(data, key19, inner, options);
    data[rKey] = data[key19];
    if (key19 !== rKey) delete data[key19];
  }
  return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
  if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
  const result = list.map((inner, index) => property(data, index, inner, options));
  if (strict) return [result];
  result.push(...data.slice(list.length));
  return [result];
});
function merge(result, data) {
  for (const key19 in data) {
    if (key19 in result) continue;
    result[key19] = data[key19];
  }
}
Schema.extend("object", (data, { dict }, options, strict) => {
  if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
  const result = {};
  for (const key19 in dict) {
    const value = property(data, key19, dict[key19], options);
    if (!isNullable(value) || key19 in data) result[key19] = value;
  }
  if (!strict) merge(result, data);
  return [result];
});
Schema.extend("union", (data, { list, toString: toString2 }, options, strict) => {
  const messages = [];
  for (const inner of list) try {
    return Schema.resolve(data, inner, options, strict);
  } catch (error) {
    messages.push(error);
  }
  throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString: toString2 }, options, strict) => {
  if (!list.length) return [data];
  let result;
  for (const inner of list) {
    const value = Schema.resolve(data, inner, options, true)[0];
    if (isNullable(value)) continue;
    if (isNullable(result)) result = value;
    else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
    else if (typeof value === "object") merge(result ??= {}, value);
    else if (result !== value) throw new ValidationError(`expected ${toString2()} but got ${JSON.stringify(data)}`, options);
  }
  if (!strict && isPlainObject(data)) merge(result, data);
  return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
  const [result, adapted = data] = Schema.resolve(data, inner, options, true);
  if (preserve) return [callback(result)];
  else return [callback(result), callback(adapted)];
});
var formatters = {};
function defineMethod(name, keys, format) {
  formatters[name] = format;
  Object.assign(Schema, { [name](...args) {
    const schema = new Schema({ type: name });
    keys.forEach((key19, index) => {
      switch (key19) {
        case "sKey":
          schema.sKey = args[index] ?? Schema.string();
          break;
        case "inner":
          schema.inner = Schema.from(args[index]);
          break;
        case "list":
          schema.list = args[index].map(Schema.from);
          break;
        case "dict":
          schema.dict = mapValues(args[index], Schema.from);
          break;
        case "bits":
          schema.bits = {};
          for (const key20 in args[index]) {
            if (typeof args[index][key20] !== "number") continue;
            schema.bits[key20] = args[index][key20];
          }
          break;
        case "callback": {
          const callback = schema.callback = args[index];
          callback["toJSON"] ||= () => callback.toString();
          break;
        }
        case "constructor": {
          const constructor = schema.constructor = args[index];
          if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
          break;
        }
        default:
          schema[key19] = args[index];
      }
    });
    if (name === "object" || name === "dict") schema.meta.default = {};
    else if (name === "array" || name === "tuple") schema.meta.default = [];
    else if (name === "bitset") schema.meta.default = 0;
    return schema;
  } });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
  if (typeof constructor === "function") return constructor.name;
  else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
  if (Object.keys(dict).length === 0) return "{}";
  return `{ ${Object.entries(dict).map(([key19, inner]) => {
    return `${key19}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
  }).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
  const result = list.map(({ toString: format }) => format()).join(" | ");
  return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
  return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
  "inner",
  "callback",
  "preserve"
], ({ inner }, isInner) => inner.toString(isInner));

// ../chat-settings.ts
var CHAT_SETTINGS_NAMESPACE = "ui-chat";
var TRANSCRIPT_VIEW_FIELD = "transcriptView";
var TRANSCRIPT_VIEW_MODES = ["compact", "detailed", "expanded"];
var LEGACY_TRANSCRIPT_VIEW_MODE = "normal";
var TRANSCRIPT_VIEW_SETTING_VALUES = [...TRANSCRIPT_VIEW_MODES, LEGACY_TRANSCRIPT_VIEW_MODE];
var DEFAULT_TRANSCRIPT_VIEW_MODE = "compact";
var PERFORMANCE_USAGE_MODES = ["compact", "detailed"];
var DEFAULT_PERFORMANCE_USAGE = "detailed";
var DEFAULT_LINK_OPENING = "sidebar";
var ChatSettingsFields = {
  linkOpening: Schema.union(["sidebar", "new-tab"]).default(DEFAULT_LINK_OPENING),
  performanceUsage: Schema.union([...PERFORMANCE_USAGE_MODES]).default(DEFAULT_PERFORMANCE_USAGE),
  [TRANSCRIPT_VIEW_FIELD]: Schema.union([...TRANSCRIPT_VIEW_SETTING_VALUES]).default(DEFAULT_TRANSCRIPT_VIEW_MODE)
};
var ChatSettingsSchema = Schema.object(ChatSettingsFields);

// settings/PreferenceRow.tsx
var import_react29 = require("react");
var import_dsh_client_ui_primitives18 = require("@deepseek-ai/dsh-client-ui-primitives");

// settings/PreferenceRow.module.css
var owner18 = "dsh-nexttavern-ui-chat";
var key18 = "dsh-nexttavern-ui-chat/runtime/alpha3/compat/ui-chat/src/client/settings/PreferenceRow.module.css";
if (![...document.querySelectorAll("style[data-plugin-css]")].some((tag) => tag.dataset.pluginCss === key18)) {
  const style = document.createElement("style");
  style.dataset.plugin = owner18;
  style.dataset.pluginCss = key18;
  style.textContent = ".viex-W_row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}.viex-W_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.viex-W_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.viex-W_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}.viex-W_selector{background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:18px;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.viex-W_selector:hover{background:var(--dsw-alias-interactive-bg-hover)}.viex-W_chevron{flex:none}";
  document.head.appendChild(style);
}
var PreferenceRow_default = { "chevron": "viex-W_chevron", "desc": "viex-W_desc", "row": "viex-W_row", "rowText": "viex-W_rowText", "selector": "viex-W_selector", "title": "viex-W_title" };

// settings/PreferenceRow.tsx
var import_jsx_runtime22 = require("react/jsx-runtime");
function PreferenceRow({ title, description, value, selectedLabel, options, onSelect }) {
  const [open, setOpen] = (0, import_react29.useState)(false);
  const selectorRef = (0, import_react29.useRef)(null);
  const closeMenu = () => {
    setOpen(false);
  };
  const selectMode = (id) => {
    selectorRef.current?.focus({ preventScroll: true });
    closeMenu();
    onSelect(id);
  };
  const selector = /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(
    "button",
    {
      ref: selectorRef,
      type: "button",
      className: PreferenceRow_default.selector,
      "aria-haspopup": "menu",
      "aria-expanded": open,
      onClick: () => {
        setOpen((value2) => !value2);
      },
      children: [
        selectedLabel,
        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_dsh_client_ui_primitives18.IconChevronDownOutlineRegular, { className: PreferenceRow_default.chevron })
      ]
    }
  );
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: PreferenceRow_default.row, children: [
    /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: PreferenceRow_default.rowText, children: [
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: PreferenceRow_default.title, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: PreferenceRow_default.desc, children: description })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
      import_dsh_client_ui_primitives18.Menu,
      {
        open,
        onClose: closeMenu,
        items: options,
        selectedId: value,
        onSelect: selectMode,
        align: "end",
        portal: true,
        anchor: selector
      }
    )
  ] });
}

// settings/TranscriptViewRow.tsx
var import_jsx_runtime23 = require("react/jsx-runtime");
var LABELS = {
  compact: "settings.transcript.compact",
  detailed: "settings.transcript.detailed",
  expanded: "settings.transcript.expanded"
};
function TranscriptViewRow({ useTranscriptView, setTranscriptView, t }) {
  const mode = useTranscriptView((value) => value);
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
    PreferenceRow,
    {
      title: t("settings.transcript.title"),
      description: t("settings.transcript.description"),
      value: mode,
      selectedLabel: t(LABELS[mode]),
      options: TRANSCRIPT_VIEW_MODES.map((id) => ({ id, label: t(LABELS[id]) })),
      onSelect: (value) => {
        setTranscriptView(value);
      }
    }
  );
}

// transcript-view.ts
var import_dsh_client_store4 = require("@deepseek-ai/dsh-client-store");
var TranscriptViewPolicy = class {
  /**
   * @param host - durable Chat settings scope.
   */
  constructor(host) {
    this.host = host;
    this.unsubscribe = host.subscribe(() => {
      this.adopt();
    });
    this.adopt();
  }
  unsubscribe;
  /** Reactive current mode; defaults to Compact before Host settings arrive. */
  mode = (0, import_dsh_client_store4.createSnapshotStore)(DEFAULT_TRANSCRIPT_VIEW_MODE);
  /** Release the accepted-value subscription. */
  dispose() {
    this.unsubscribe();
  }
  /**
   * Publish and persist one explicit user choice.
   * @param mode - Compact, Detailed, or Expanded work details.
   */
  setMode(mode) {
    if (this.mode.getSnapshot() === mode) return;
    this.mode.set(mode);
    void this.host.set(TRANSCRIPT_VIEW_FIELD, mode);
  }
  /** Adopt the latest accepted Host section without writing it back. */
  adopt() {
    const section = this.host.getSnapshot().value;
    if (section === void 0) return;
    const mode = section.transcriptView === LEGACY_TRANSCRIPT_VIEW_MODE ? "detailed" : section.transcriptView;
    if (this.mode.getSnapshot() !== mode) this.mode.set(mode);
  }
};

// presentation-policy.ts
var POLICIES = {
  compact: {
    mode: "compact",
    foldCompletedTurns: true,
    stepGrouping: "collapsed",
    liveProcessDetail: false,
    settledReasoningPreview: false
  },
  detailed: {
    mode: "detailed",
    foldCompletedTurns: true,
    stepGrouping: "collapsed",
    liveProcessDetail: true,
    settledReasoningPreview: true
  },
  expanded: {
    mode: "expanded",
    foldCompletedTurns: true,
    stepGrouping: "none",
    liveProcessDetail: true,
    settledReasoningPreview: true
  }
};
function derivePresentationPolicy(mode) {
  return {
    getSnapshot: () => POLICIES[mode.getSnapshot()],
    subscribe: (listener) => mode.subscribe(listener)
  };
}

// settings/LinkOpeningRow.tsx
var import_jsx_runtime24 = require("react/jsx-runtime");
function LinkOpeningRow({ useLinkOpening, useBrowserAvailable, setLinkOpening, t }) {
  const destination = useLinkOpening((value) => value);
  const browserAvailable = useBrowserAvailable((value) => value);
  if (!browserAvailable) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
    PreferenceRow,
    {
      title: t("settings.links.title"),
      description: t("settings.links.description"),
      value: destination,
      selectedLabel: t(destination === "sidebar" ? "settings.links.sidebar" : "settings.links.newTab"),
      options: [
        { id: "sidebar", label: t("settings.links.sidebar") },
        { id: "new-tab", label: t("settings.links.newTab") }
      ],
      onSelect: (value) => {
        setLinkOpening(value);
      }
    }
  );
}

// settings/PerformanceUsageRow.tsx
var import_jsx_runtime25 = require("react/jsx-runtime");
var OPTIONS = [
  { id: "compact", label: "settings.performance.compact" },
  { id: "detailed", label: "settings.performance.detailed" }
];
function PerformanceUsageRow({ usePerformanceUsage, setPerformanceUsage, t }) {
  const mode = usePerformanceUsage((value) => value);
  const selectedLabel = mode === "detailed" ? "settings.performance.detailed" : "settings.performance.compact";
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
    PreferenceRow,
    {
      title: t("settings.performance.title"),
      description: t("settings.performance.description"),
      value: mode,
      selectedLabel: t(selectedLabel),
      options: OPTIONS.map((option) => ({ id: option.id, label: t(option.label) })),
      onSelect: (value) => {
        setPerformanceUsage(value);
      }
    }
  );
}

// performance-usage.ts
var import_dsh_client_store5 = require("@deepseek-ai/dsh-client-store");
var PerformanceUsagePolicy = class {
  /** @param host - Chat settings scope, durable on loopback and memory-only elsewhere. */
  constructor(host) {
    this.host = host;
    const adopt = () => {
      const accepted = host.getSnapshot().value?.performanceUsage;
      if (accepted !== void 0) this.mode.set(accepted);
    };
    this.unsubscribe = host.subscribe(adopt);
    adopt();
  }
  unsubscribe;
  /** Current choice, reconciled with accepted Host settings when available. */
  mode = (0, import_dsh_client_store5.createSnapshotStore)(DEFAULT_PERFORMANCE_USAGE);
  /** Release the accepted-value subscription. */
  dispose() {
    this.unsubscribe();
  }
  /**
   * Publish a choice immediately and persist it when the scope supports writes.
   * @param mode - Statistics detail selected by the user.
   */
  setMode(mode) {
    if (mode === this.mode.getSnapshot()) return;
    this.mode.set(mode);
    void this.host.set("performanceUsage", mode);
  }
};

// chat/use-turn-data.ts
var import_react30 = require("react");
var EMPTY_SOURCE = {
  getSnapshot: () => void 0,
  subscribe: () => () => {
  }
};
function useTurnDataValue(data, key19) {
  const source = data?.source(key19) ?? EMPTY_SOURCE;
  return (0, import_react30.useSyncExternalStore)(source.subscribe, source.getSnapshot);
}

// apply.ts
var CHAT_NODE_INJECT = {
  hooks: {
    turnData: (_standard, { turnData }) => function useTurnData(key19) {
      return useTurnDataValue(turnData, key19);
    },
    disclosure: (_standard, { disclosureReset }) => bindDisclosure(disclosureReset)
  }
};
var inject = [
  "slots",
  "sessions",
  "uiWorkspace",
  "uiSession",
  "uiConversation",
  "locale",
  "configForms",
  "remote",
  "remote.session",
  "sidebarRight"
];
function apply(ctx) {
  const chatSources = /* @__PURE__ */ new WeakMap();
  const chatSource = (binding) => {
    let source = chatSources.get(binding);
    if (source === void 0) {
      const target = ctx.uiConversation.binding(binding).target("chat");
      source = {
        getSnapshot: () => target.getSnapshot() ?? EMPTY_CHAT_SNAPSHOT,
        subscribe: (listener) => target.subscribe(listener)
      };
      chatSources.set(binding, source);
    }
    return source;
  };
  registerConversationNodes(ctx);
  ctx.uiSession.provide({
    hooks: ["chat"],
    resolve: (binding) => ({ hooks: { chat: chatSource(binding) } })
  });
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ui-chat: dictionaries");
  const t = ctx.locale.bind(NS);
  const chatStore = createChatStore();
  const chatScrollPositions = /* @__PURE__ */ new Map();
  const chatSettings = ctx.configForms.get(CHAT_SETTINGS_NAMESPACE);
  const linkOpening = (0, import_dsh_client_store6.createSnapshotStore)(chatSettings.getSnapshot().value?.linkOpening ?? DEFAULT_LINK_OPENING);
  ctx.effect(() => chatSettings.subscribe(() => {
    const accepted = chatSettings.getSnapshot().value?.linkOpening;
    if (accepted !== void 0) linkOpening.set(accepted);
  }));
  ctx.inject(["sidebarRightTabs"], (scope) => {
    const tabs = scope.sidebarRightTabs;
    const browserAvailable = {
      getSnapshot: () => tabs.get("browser") !== void 0,
      subscribe: (listener) => tabs.subscribe(listener)
    };
    scope.slots.inject("settings.general.item", () => scope.slots.register({
      name: "settings.general.item",
      id: "link-opening",
      order: 14,
      locale: NS,
      inject: () => ({
        hooks: { linkOpening, browserAvailable },
        setLinkOpening: (destination) => {
          linkOpening.set(destination);
          void chatSettings.set("linkOpening", destination).catch((_error) => {
          });
        }
      })
    }, LinkOpeningRow));
  });
  const transcriptView = new TranscriptViewPolicy(chatSettings);
  const presentation = derivePresentationPolicy(transcriptView.mode);
  const performancePolicy = new PerformanceUsagePolicy(chatSettings);
  ctx.effect(() => () => {
    transcriptView.dispose();
    performancePolicy.dispose();
  });
  const performanceUsage = performancePolicy.mode;
  registerChatNodeRenderers(ctx, performanceUsage, presentation);
  ctx.slots.inject("settings.general.item", () => ctx.slots.register({
    name: "settings.general.item",
    id: "performance-usage",
    order: 13,
    locale: NS,
    inject: () => ({
      hooks: { performanceUsage },
      setPerformanceUsage: (mode) => {
        performancePolicy.setMode(mode);
      }
    })
  }, PerformanceUsageRow));
  ctx.slots.inject("settings.general.item", () => ctx.slots.register({
    name: "settings.general.item",
    id: "transcript-view",
    order: 12,
    locale: NS,
    inject: () => ({
      hooks: { transcriptView: transcriptView.mode },
      setTranscriptView: (mode) => {
        transcriptView.setMode(mode);
      }
    })
  }, TranscriptViewRow));
  ctx.slots.inject("conversation.view", () => {
    const disposeView = ctx.slots.register({
      name: "conversation.view",
      id: "chat",
      order: 0,
      label: () => t("view.chat"),
      locale: NS,
      children: {
        "conversation.chat.node": { kind: "keyed", scope: "session", inject: CHAT_NODE_INJECT },
        "conversation.message.images": { kind: "single", scope: "session" },
        "conversation.chat.roleplay-progress": { kind: "list", scope: "session" }
      },
      store: chatStore,
      inject: (sessionId) => {
        const binding = ctx.sessions.binding(sessionId);
        if (binding === void 0) throw new Error(`ui-chat: unknown session "${sessionId}"`);
        const session = binding.session;
        const chat = chatSource(binding);
        const conversation = ctx.uiConversation.binding(binding);
        return {
          hooks: { presentation },
          keyedHooks: {
            chatNode: (key19) => chat.getSnapshot().nodes.source(key19),
            chatNodeProcess: (key19) => chat.getSnapshot().nodes.processSource(key19),
            chatGroup: (key19) => conversation.snapshot.getSnapshot().views.grouped("chat")?.groupSource(key19)
          },
          fileMentions: (owner19) => ctx.get("chatFileMentions")?.forClosing(owner19, sessionId),
          // Files open in the right Sidebar, not in a desktop application: the
          // content stays in the product, beside the conversation that produced
          // it. A relative path, or an absolute one inside the session's
          // workspace, is addressed under this session's scope,
          // `dsh-resource://file/session/<id>/<path>`; an absolute path
          // elsewhere keeps its absolute spelling in the same Session's address.
          // Which tab type claims the
          // address is the Sidebar's decision, not this call site's.
          // A line travels as a navigation parameter, not as part of the
          // address: the file is one piece of content whether it is opened at
          // its top or at line 400, so the same tab is revealed and told where
          // to land.
          openFile: async (path, options) => {
            const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
            const url = fileAddressFor(sessionId, cwd, path);
            if (options?.line === void 0) ctx.sidebarRight.openResource(url);
            else ctx.sidebarRight.openResource(url, { params: { line: options.line } });
            await Promise.resolve();
          },
          openSkill: (name) => {
            const scope = ctx.sessions.scope(sessionId);
            if (scope === void 0) return;
            ctx.get("inputTriggers")?.sessionOf(scope).openReference("skill", { ref: `/${name}` });
          },
          openExternalLink: (url) => {
            if (linkOpening.getSnapshot() === "sidebar" && ctx.get("sidebarRightTabs")?.get("browser") !== void 0) {
              ctx.sidebarRight.openTab("browser", { params: { url } });
            } else {
              window.open(url, "_blank", "noopener,noreferrer");
            }
          },
          loadOlder: () => {
            void session.loadOlder();
          },
          loadThrough: (seq) => session.loadThrough(seq),
          loadImage: Object.assign(
            (attachment) => ctx.uiConversation.imageUrl(sessionId, attachment),
            { peek: (attachment) => ctx.uiConversation.peekImageUrl(sessionId, attachment) }
          ),
          chatScroll: {
            save: (position) => {
              if (position === null) chatScrollPositions.delete(sessionId);
              else chatScrollPositions.set(sessionId, position);
            },
            read: () => chatScrollPositions.get(sessionId) ?? null
          },
          forkAt: (seq) => {
            ctx.sessions.fork({ sessionId, atSeq: seq, increaseTitle: true }).then((childId) => {
              ctx.uiWorkspace.openSession(childId);
            }).catch(() => {
            });
          }
        };
      }
    }, ChatView);
    return disposeView;
  });
  ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
    name: "conversation.composer.dock",
    id: "stats",
    order: 0,
    locale: NS,
    inject: () => ({ hooks: { performanceUsage } })
  }, StatsPills));
  ctx.slots.inject("conversation.approval.detail", () => ctx.slots.register({ name: "conversation.approval.detail" }, ApprovalCommand));
}
return module.exports; } });
