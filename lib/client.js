window.__ModuleLoader__.load({ id: "dsh-nexttavern", factory: function (require) { var module = { exports: {} }; var exports = module.exports;
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
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client.js
var client_exports = {};
__export(client_exports, {
  MODEL_PURPOSE_IDS: () => MODEL_PURPOSE_IDS,
  apply: () => apply,
  backgroundNotesPresentation: () => backgroundNotesPresentation,
  buildCustomRulesSaveBody: () => buildCustomRulesSaveBody,
  buildModelSettings: () => buildModelSettings,
  buildReasoningEffortOptions: () => buildReasoningEffortOptions,
  buildRulesSaveBody: () => buildRulesSaveBody,
  confirmWithDialog: () => confirmWithDialog,
  createRefreshScheduler: () => createRefreshScheduler,
  createToastController: () => createToastController,
  fetchRoleplayText: () => fetchRoleplayText,
  formatFallbackText: () => formatFallbackText,
  inject: () => inject,
  isCardReadableResource: () => isCardReadableResource,
  markPanelDraftFields: () => markPanelDraftFields,
  normalizePricingSettings: () => normalizePricingSettings,
  settlePanelDraftFields: () => settlePanelDraftFields,
  sortLibraryResources: () => sortLibraryResources,
  startActivityPolling: () => startActivityPolling,
  tavernActivityPresentation: () => tavernActivityPresentation,
  updatePanelDraft: () => updatePanelDraft,
  usageCostPresentation: () => usageCostPresentation
});
module.exports = __toCommonJS(client_exports);

// roleplay-ui-styles.js
var ROLEPLAY_UI_CSS = `
/* Orca's expanded stage decoration belongs to New Session but extends across
   the Tavern entry. Only the real button box should receive its clicks. */
body[data-dsh-orca-link] [data-slot="sidebar"] > :first-child > button:not([data-dsh-part="sidebar-entry"])::before,
body[data-dsh-orca-link] [data-slot="sidebar"] > :first-child > button:not([data-dsh-part="sidebar-entry"])::after {
  pointer-events: none !important;
}
.dsh-rp-actions { display: inline-flex; gap: 6px; align-items: center; }
.dsh-rp-btn {
  font: inherit; font-size: 11px; line-height: 20px; padding: 1px 7px; border-radius: 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  background: var(--dsw-alias-bg-layer-2, transparent); color: var(--dsw-alias-label-secondary, inherit);
  cursor: pointer; white-space: nowrap;
}
.dsh-rp-btn:hover { border-color: var(--dsw-alias-brand-primary, #4c7dff); color: var(--dsw-alias-brand-primary, #4c7dff); }
.dsh-rp-btn.dsh-rp-on { border-color: var(--dsw-alias-brand-primary, #4c7dff); color: var(--dsw-alias-brand-primary, #4c7dff); }
.dsh-rp-btn:disabled { opacity: .45; cursor: default; }
.dsh-rp-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; padding: 0; border: none; border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-secondary, #999); cursor: pointer;
}
.dsh-rp-icon-btn:hover { background: var(--dsw-alias-bg-layer-2, rgba(128,128,128,.12)); color: var(--dsw-alias-brand-primary, #4c7dff); }
.dsh-rp-icon-btn:disabled { opacity: .35; cursor: default; }
.dsh-rp-icon-btn:disabled:hover { background: transparent; color: var(--dsw-alias-label-secondary, #999); }
.dsh-rp-pager { font-size: 11px; color: var(--dsw-alias-label-secondary, #999); margin: 0 2px; }
.dsh-rp-deleted { font-size: 11px; color: var(--dsw-alias-label-tertiary, #999); padding: 0 5px; }
.dsh-rp-edit-backdrop {
  position: fixed; inset: 0; z-index: 12000; display: flex; align-items: center; justify-content: center;
  margin: 0; border: 0; box-sizing: border-box; width: 100%; height: 100%; max-width: none; max-height: none;
  padding: 18px; background: rgba(18, 16, 20, .28); backdrop-filter: blur(3px);
}
.dsh-rp-edit-backdrop:not([open]) { display: none; }
.dsh-rp-edit-backdrop::backdrop { background: transparent; }
.dsh-rp-edit-card {
  width: min(720px, 94vw); max-height: min(680px, 86vh); display: flex; flex-direction: column; gap: 12px;
  padding: 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,.42);
  background: var(--dsw-alias-bg-layer-1, #fffaf6); color: var(--dsw-alias-label-primary, #413a3d);
  box-shadow: 0 24px 70px rgba(37,27,33,.28), inset 0 1px 0 rgba(255,255,255,.8);
}
.dsh-rp-edit-title { font-size: 14px; font-weight: 650; }
.dsh-rp-edit-textarea {
  width: 100%; min-height: 220px; max-height: 56vh; resize: vertical; box-sizing: border-box;
  padding: 12px 14px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28));
  background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.6)); color: inherit; font: inherit; line-height: 1.6;
}
.dsh-rp-edit-buttons { display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
.dsh-rp-edit-hint { margin-right: auto; font-size: 11px; color: var(--dsw-alias-label-tertiary, #999); }
.dsh-rp-edit-action { padding: 5px 14px; border-radius: 9px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3)); background: transparent; color: inherit; cursor: pointer; }
.dsh-rp-edit-action[data-primary="true"] { color: #fff; border-color: #8d6f7d; background: linear-gradient(135deg, #b98c7b, #8d7186); }
.dsh-rp-toast {
  position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 9000;
  background: var(--dsw-alias-bg-overlay, #222); color: var(--dsw-alias-label-primary, #eee);
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.4));
  border-radius: 8px; padding: 6px 14px; font-size: 12px; max-width: 70vw;
  box-shadow: 0 4px 16px rgba(0,0,0,.35); pointer-events: none;
}
.dsh-rp-dialog .dsh-rp-toast { position: absolute; bottom: 16px; z-index: 2; }
.dsh-rp-confirm-dialog { width: min(420px, calc(100vw - 32px)); margin: auto; padding: 18px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35)); border-radius: 12px; color: var(--dsw-alias-label-primary, #413a3d); background: var(--dsw-alias-bg-layer-1, #fffaf6); box-shadow: 0 20px 70px rgba(0,0,0,.35); }
.dsh-rp-confirm-dialog::backdrop { background: rgba(0,0,0,.34); backdrop-filter: blur(2px); }
.dsh-rp-confirm-dialog p { margin: 10px 0 16px; line-height: 1.55; white-space: pre-wrap; }
.dsh-rp-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; }
.dsh-rp-confirm-dialog .dsh-rp-btn { min-height: 30px; padding: 5px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2, #f7f4ee); color: var(--dsw-alias-label-primary, #413a3d); }
.dsh-rp-confirm-dialog .dsh-rp-primary { background: var(--dsw-alias-brand-primary, #3375db); border-color: var(--dsw-alias-brand-primary, #3375db); color: var(--dsw-alias-static-white, #fff); }
/* \u4FA7\u8FB9\u680F\u9762\u677F */
.dsh-rp-panel { display: flex; flex-direction: column; gap: 8px; padding: 8px 10px; font-size: 12px; height: 100%; overflow-y: auto; }
.dsh-rp-panel h4 { margin: 4px 0 2px; font-size: 12px; }
.dsh-rp-dialog { position: fixed; inset: 8vh 8vw; z-index: 2147483000; width: auto; max-width: none; height: 84vh; max-height: 84vh; padding: 0; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28)); border-radius: 14px; color: var(--dsw-alias-label-primary, #413a3d); background: var(--dsw-alias-bg-layer-1, #fffaf6); background: rgb(from var(--dsw-alias-bg-layer-1, #fffaf6) r g b / 1); box-shadow: 0 24px 90px rgba(0,0,0,.4); overflow: hidden; display: flex; flex-direction: column; }
.dsh-rp-dialog::backdrop { background: rgba(0,0,0,.34); backdrop-filter: blur(2px); }
.dsh-rp-dialog button, .dsh-rp-dialog input, .dsh-rp-dialog select, .dsh-rp-dialog textarea { font: inherit; color: inherit; }
.dsh-rp-dialog button { appearance: none; }
.dsh-rp-dialog input, .dsh-rp-dialog select, .dsh-rp-dialog textarea { background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.78)); background: rgb(from var(--dsw-alias-bg-layer-2, #f7f4ee) r g b / 1); color: var(--dsw-alias-label-primary, #413a3d); }
.dsh-rp-dialog .dsh-rp-btn { appearance: none; min-height: 30px; padding: 5px 10px; border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35)); border-radius: 8px; background: var(--dsw-alias-bg-layer-2, #f7f4ee); background: rgb(from var(--dsw-alias-bg-layer-2, #f7f4ee) r g b / 1); color: var(--dsw-alias-label-primary, #413a3d); font: inherit; line-height: 1.25; cursor: pointer; transition: background-color .15s ease, border-color .15s ease, box-shadow .15s ease; }
.dsh-rp-dialog .dsh-rp-btn:hover:not(:disabled) { border-color: var(--dsw-alias-border-l1, rgba(101,86,94,.5)); background: var(--dsw-alias-bg-layer-3, #eee8e2); }
.dsh-rp-dialog .dsh-rp-btn:focus-visible, .dsh-rp-dialog input:focus-visible, .dsh-rp-dialog select:focus-visible, .dsh-rp-dialog textarea:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #8e6879); outline-offset: 2px; }
.dsh-rp-dialog .dsh-rp-btn:disabled { cursor: not-allowed; opacity: .55; }
.dsh-rp-dialog-head, .dsh-rp-dialog-tabs { flex: 0 0 auto; }
.dsh-rp-dialog-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.2)); }
.dsh-rp-dialog-head strong { flex: 1; }
.dsh-rp-dialog-tabs { display: grid; gap: 7px; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.16)); }
.dsh-rp-dialog-tab-row { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.dsh-rp-dialog-tab-divider { height: 1px; background: var(--dsw-alias-border-l2, rgba(128,128,128,.16)); }
.dsh-rp-dialog .dsh-rp-dialog-tabs .dsh-rp-btn[aria-selected="true"] { border-color: var(--dsw-alias-brand-primary, #8e6879); background: var(--dsw-alias-brand-primary, #8e6879); color: var(--dsw-alias-static-white, #fff); box-shadow: inset 0 1px 0 rgba(255,255,255,.18); }
.dsh-rp-dialog > .dsh-rp-panel { flex: 1 1 auto; min-height: 0; height: auto; overflow-y: auto; padding: 14px 16px 24px; }
.dsh-rp-dialog .dsh-rp-panel > * { flex-shrink: 0; }
.dsh-rp-dialog, .dsh-rp-dialog * { box-sizing: border-box; }
.dsh-rp-dialog { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.dsh-rp-dialog .dsh-rp-section-title { font-size: 17px; font-weight: 650; margin: 4px 0 2px; }
.dsh-rp-telemetry { gap: 18px; }
.dsh-rp-dialog .dsh-rp-filters { display:flex; align-items:flex-end; flex-wrap:wrap; gap:12px; }
.dsh-rp-dialog .dsh-rp-filter { display:flex; flex-direction:column; gap:5px; font-size:12px; }
.dsh-rp-dialog .dsh-rp-filter select { max-width:260px; }
.dsh-rp-dialog .dsh-rp-metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; }
.dsh-rp-dialog .dsh-rp-metric, .dsh-rp-stat-chart, .dsh-rp-price-details { border:1px solid var(--dsw-alias-border-l2,#dedede); border-radius:12px; padding:16px; background:var(--dsw-alias-bg-layer-2,#fff); }
.dsh-rp-dialog .dsh-rp-metric { display:flex; flex-direction:column; gap:9px; min-width:0; }
.dsh-rp-dialog .dsh-rp-metric > span, .dsh-rp-metric small { opacity:.72; font-size:12px; }
.dsh-rp-dialog .dsh-rp-metric strong { font-size:24px; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.dsh-rp-dialog .dsh-rp-stat-chart svg { display:block; width:100%; max-height:300px; min-height:160px; }
.dsh-rp-dialog .dsh-rp-chart-legend { display:flex; justify-content:center; gap:18px; flex-wrap:wrap; font-size:12px; }
.dsh-rp-dialog .dsh-rp-table-wrap { width:100%; overflow:auto; border:1px solid var(--dsw-alias-border-l2,#dedede); border-radius:10px; }
.dsh-rp-dialog .dsh-rp-table small { display:block; }
.dsh-rp-dialog .dsh-rp-table { width:100%; border-collapse:collapse; font-size:12px; font-variant-numeric:tabular-nums; }
.dsh-rp-dialog .dsh-rp-table th { background:var(--dsw-alias-bg-layer-2,#f8f9fb); text-align:left; font-weight:550; white-space:nowrap; }
.dsh-rp-dialog .dsh-rp-table th, .dsh-rp-table td { padding:12px 14px; border-bottom:1px solid var(--dsw-alias-border-l2,#e4e4e4); vertical-align:top; }
.dsh-rp-dialog .dsh-rp-table td { min-width:65px; overflow-wrap:anywhere; }
.dsh-rp-dialog .dsh-rp-table input { width:92px; min-width:72px; }
.dsh-rp-dialog .dsh-rp-status-badge { display:inline-block; padding:3px 8px; border-radius:20px; white-space:nowrap; background:rgba(100,120,145,.12); }
.dsh-rp-dialog .dsh-rp-state-completed { color:#16805b; background:rgba(20,168,123,.12); }
.dsh-rp-dialog .dsh-rp-state-failed, .dsh-rp-state-truncated { color:#bf4e48; background:rgba(190,78,72,.12); }
.dsh-rp-dialog .dsh-rp-pricing { display:flex; flex-direction:column; gap:14px; padding-top:12px; }
.dsh-rp-dialog .dsh-rp-price-details summary { cursor:pointer; font-weight:600; }
.dsh-rp-dialog .dsh-rp-empty { padding:32px 16px; text-align:center; opacity:.65; }
.dsh-rp-dialog .dsh-rp-panel { font-size:13px; line-height:1.6; }
.dsh-rp-dialog .dsh-rp-btn { border-radius:8px !important; font-size:13px !important; min-height:34px; padding:6px 12px !important; text-decoration:none; }
.dsh-rp-dialog :is(input, select, textarea) { border-radius:8px !important; padding:7px 10px !important; font-size:13px !important; line-height:1.5; min-height:34px; border:1px solid var(--dsw-alias-border-l2,#d8dee8); }
.dsh-rp-dialog :is(input[type=checkbox], input[type=radio]) { min-height:0; padding:0 !important; }
body[data-dsh-orca-link] .dsh-rp-dialog .dsh-rp-btn { border-radius:8px !important; }
body[data-dsh-orca-link] .dsh-rp-dialog :is(input, select, textarea) { border-radius:8px !important; }
.dsh-rp-dialog .dsh-rp-dialog-tabs { gap:6px; padding:10px 12px; }
.dsh-rp-dialog .dsh-rp-dialog-tabs .dsh-rp-btn { border-color:transparent; background:transparent; }
.dsh-rp-dialog .dsh-rp-dialog-tabs .dsh-rp-btn[aria-selected=true], .dsh-rp-dialog .dsh-rp-primary { background:#3375db; border-color:#3375db; color:white; }
.dsh-rp-dialog .dsh-rp-usage-tabs { display:flex; flex-wrap:nowrap; gap:6px; max-width:100%; overflow-x:auto; padding:2px 0; }
.dsh-rp-dialog .dsh-rp-usage-tabs .dsh-rp-btn { flex:0 0 auto; border-color:transparent; background:transparent; }
.dsh-rp-dialog .dsh-rp-usage-tabs .dsh-rp-btn[aria-selected=true] { background:#3375db; border-color:#3375db; color:white; }
.dsh-rp-dialog fieldset.dsh-rp-pricing { border:0; margin:0; padding:12px 0 0; min-width:0; }
.dsh-rp-dialog .dsh-rp-scan-progress { padding:10px 12px; border-radius:8px; color:#315c92; background:rgba(51,117,219,.09); }
.dsh-rp-dialog .dsh-rp-pricing { display:grid; gap:14px; min-width:0; }
.dsh-rp-dialog .dsh-rp-pricing-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:12px; }
.dsh-rp-dialog .dsh-rp-pricing-card { display:grid; gap:9px; min-width:0; padding:14px; border:1px solid var(--dsw-alias-border-l2,#d8dee8); border-radius:12px; background:var(--dsw-alias-bg-layer-2,#fff); }
.dsh-rp-dialog .dsh-rp-pricing-card h5 { margin:0; font-size:14px; }
.dsh-rp-dialog .dsh-rp-pricing-card label { display:grid; min-width:0; gap:4px; color:var(--dsw-alias-label-secondary,#667); }
.dsh-rp-dialog .dsh-rp-pricing :is(select, input:not([type=checkbox])) { width: 100%; min-width: 0; max-width: 100%; box-sizing: border-box; }
.dsh-rp-dialog .dsh-rp-pricing-list { display:grid; gap:12px; }
.dsh-rp-dialog .dsh-rp-pricing-auto { display:grid; grid-template-columns: minmax(0, 1fr) minmax(90px, 150px); gap:12px; }
.dsh-rp-dialog .dsh-rp-pricing-manual { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr)); gap:9px; }
.dsh-rp-dialog .dsh-rp-pricing-auto > .dsh-rp-muted { grid-column:1 / -1; }
@media (max-width: 600px) { .dsh-rp-dialog .dsh-rp-pricing-auto { grid-template-columns: minmax(0, 1fr); } }
.dsh-rp-dialog .dsh-rp-input, .dsh-rp-dialog .dsh-rp-textarea { border-radius: 8px; border-color: var(--dsw-alias-border-l2, rgba(128,128,128,.35)); padding: 7px 9px; }
.dsh-rp-dialog .dsh-rp-item { border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.2)); border-radius: 10px; background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,.45)); box-shadow: 0 1px 2px rgba(56,40,48,.05); }
.dsh-rp-dialog .dsh-rp-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dsh-rp-dialog a.dsh-rp-btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; }
@media (max-width: 760px) { .dsh-rp-dialog { inset: 0; width: 100vw; height: 100dvh; max-height: none; border-radius: 0; } .dsh-rp-dialog-tab-row { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 2px; } .dsh-rp-dialog-tab-row .dsh-rp-btn { flex: 0 0 auto; } }
.dsh-rp-textarea {
  width: 100%; min-height: 120px; box-sizing: border-box; font: inherit; font-size: 12px; line-height: 1.6;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35)); border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1, transparent); color: var(--dsw-alias-label-primary, inherit);
  padding: 6px 8px; resize: vertical;
}
.dsh-rp-input {
  width: 100%; box-sizing: border-box; font: inherit; font-size: 12px; padding: 4px 8px; margin: 2px 0;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35)); border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1, transparent); color: var(--dsw-alias-label-primary, inherit);
}
.dsh-rp-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.dsh-rp-item { border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.3)); border-radius: 8px; padding: 6px 8px; }
.dsh-rp-item-head { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.dsh-rp-item-title { font-weight: 600; }
.dsh-rp-muted { color: var(--dsw-alias-label-secondary, #999); font-size: 11px; }
.dsh-rp-num { width: 90px; }
.dsh-rp-error { color: var(--dsw-alias-state-error, #e5484d); font-size: 12px; }
/* \u72B6\u6001\u680F\u60AC\u6D6E\u7A97\uFF08\u4EC5 roleplay \u6A21\u5F0F\uFF09\uFF1A\u53EF\u62D6\u52A8\uFF08\u6807\u9898\u680F\uFF09\u3001\u53F3\u4E0B\u89D2\u624B\u67C4\u53EF\u7F29\u653E */
.dsh-rp-status-window {
  position: fixed; right: 14px; bottom: 14px; z-index: 8500; width: 264px; max-width: calc(100vw - 28px);
  background: var(--dsw-alias-bg-layer-1, #1c1e24); border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  background: rgb(from var(--dsw-alias-bg-layer-1, #1c1e24) r g b / 1);
  border-radius: 12px; box-shadow: 0 8px 28px rgba(0,0,0,.4); padding: 10px 12px;
  font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-primary, #e8e8ec);
  max-height: 80vh; overflow-y: auto; container-type: inline-size; box-sizing: border-box; min-width: 0;
  display: flex; flex-direction: column;
}
.dsh-rp-status-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; cursor: move; touch-action: none; user-select: none; }
.dsh-rp-status-title { font-weight: 700; font-size: 13px; color: var(--dsw-alias-brand-primary, #7d9bff); cursor: move; }
.dsh-rp-status-resize {
  position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize;
  touch-action: none; opacity: .55;
  background: linear-gradient(135deg, transparent 50%, var(--dsw-alias-border-l2, rgba(128,128,128,.5)) 50%);
  border-bottom-right-radius: 11px;
}
.dsh-rp-status-resize:hover { opacity: 1; }
.dsh-rp-status-title { font-weight: 700; font-size: 13px; color: var(--dsw-alias-brand-primary, #7d9bff); }
.dsh-rp-status-min {
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--dsw-alias-label-secondary, #999);
  width: 22px; height: 22px; border-radius: 5px; cursor: pointer; padding: 0;
}
.dsh-rp-status-min:hover { background: var(--dsw-alias-bg-layer-2, rgba(128,128,128,.12)); }
.dsh-rp-status-field { margin: 2px 0; white-space: pre-wrap; word-break: break-word; }
.dsh-rp-status-emoji { display: inline-block; width: 22px; }
.dsh-rp-status-html {
  flex: 1 1 auto; min-height: 0; overflow-y: auto;
  font-size: 12px; line-height: 1.6; word-break: break-word;
}
.dsh-rp-status-window .dsh-rp-status-author, .dsh-rp-status-dock .dsh-rp-status-author {
  display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0;
}
/* Author cards sometimes use a viewport-sized root with their own scrollbox.
   Adapt only that first layout root to the host's available height; nested
   author panels keep their own overflow rules and remain isolated. */
.dsh-rp-status-window .dsh-rp-status-html > [data-dsh-status-fill-root],
.dsh-rp-status-dock .dsh-rp-status-html > [data-dsh-status-fill-root] {
  box-sizing: border-box; width: 100%; min-height: 100%; height: auto !important;
  max-height: none !important; overflow: visible !important;
}
.dsh-rp-status-empty { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; min-height: 160px; padding: 20px 12px; text-align: center; color: var(--dsw-alias-label-secondary, #999); }
.dsh-rp-status-stale { padding: 5px 0 8px; color: var(--dsw-alias-label-secondary, #999); font-size: 11px; }
.dsh-rp-status-html ul { list-style: none; padding: 0; margin: 0; }
.dsh-rp-status-html .f, .dsh-rp-status-html [class="f"] {
  cursor: pointer; border-radius: 8px; padding: 6px 9px; margin: 4px 0;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  background: var(--dsw-alias-bg-layer-2, transparent);
}
.dsh-rp-status-html .f:hover, .dsh-rp-status-html [class="f"]:hover { border-color: var(--dsw-alias-brand-primary, #4c7dff); }
.dsh-rp-status-options { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.dsh-rp-status-option {
  text-align: left; font: inherit; font-size: 12px; line-height: 1.5; padding: 6px 9px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  background: var(--dsw-alias-bg-layer-2, transparent); color: var(--dsw-alias-label-primary, inherit); cursor: pointer;
  white-space: pre-wrap; word-break: break-word;
}
.dsh-rp-status-option:hover { border-color: var(--dsw-alias-brand-primary, #4c7dff); }
.dsh-rp-status-badge {
  position: fixed; right: max(14px, env(safe-area-inset-right)); top: 62vh; bottom: auto; z-index: 8500;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 13px 7px 10px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  background: linear-gradient(135deg, var(--dsw-alias-bg-layer-1, #1c1e24) 0%, var(--dsw-alias-bg-layer-2, #23262e) 100%);
  box-shadow: 0 6px 20px rgba(0,0,0,.38);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  cursor: grab; user-select: none; touch-action: none;
  font-size: 12px; line-height: 1; color: var(--dsw-alias-label-primary, #e8e8ec);
  max-width: 240px;
  transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
}
.dsh-rp-status-badge:hover {
  transform: translateY(-1px);
  border-color: var(--dsw-alias-brand-primary, #4c7dff);
  box-shadow: 0 8px 24px rgba(0,0,0,.45), 0 0 12px rgba(76,125,255,.16);
}
.dsh-rp-status-badge:active { cursor: grabbing; }
.dsh-rp-status-badge-icon { color: var(--dsw-alias-brand-primary, #4c7dff); font-size: 13px; line-height: 1; }
.dsh-rp-status-badge-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.dsh-rp-status-badge-dot {
  width: 6px; height: 6px; border-radius: 50%; flex: none;
  background: #43d9a3; box-shadow: 0 0 6px rgba(67,217,163,.9);
  animation: dsh-rp-badge-pulse 2.2s ease-in-out infinite;
}
@keyframes dsh-rp-badge-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
/* \u6A21\u5F0F\u5207\u6362\u6309\u94AE\u7531\u5DE5\u4F5C\u533A\u6807\u9898\u884C\u63D2\u69FD\u5E03\u5C40\u3002 */
.dsh-rp-nav-entry {
  box-sizing: border-box; width: 100%; height: 36px; flex: none;
  display: flex; align-items: center; gap: 8px; padding: 0 10px; margin: 0;
  border: none; border-radius: 8px; background: transparent;
  color: var(--dsw-alias-label-secondary); font: inherit; font-size: 13px;
  white-space: nowrap; cursor: pointer;
}
.dsh-rp-nav-icon { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex: none; }
.dsh-rp-nav-icon svg { display: block; width: 18px; height: 18px; }
.dsh-rp-nav-label { overflow: hidden; text-overflow: ellipsis; }
.dsh-rp-nav-entry:hover:not(:disabled), .dsh-rp-status-toggle:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dsh-rp-nav-entry:disabled, .dsh-rp-status-toggle:disabled { opacity: .4; cursor: default; }
.dsh-rp-nav-entry:focus-visible, .dsh-rp-status-toggle:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4c7dff); outline-offset: -2px; }
[data-sidebar-collapsed] .dsh-rp-nav-entry { width: 36px; height: 36px; margin: 0 auto 12px; padding: 0; border-radius: 50%; justify-content: center; }
[data-sidebar-collapsed] .dsh-rp-nav-label { display: none; }
.dsh-rp-status-toggle {
  position: relative; flex: none; box-sizing: border-box; margin-left: auto;
  width: 28px; height: 28px; padding: 0; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; cursor: pointer;
}
.dsh-rp-status-toggle svg { display: block; width: 16px; height: 16px; }
/* Native Tooltip inserts a sibling between actions while open. Keep the
   leading auto space on the first action regardless of tooltip visibility. */
.dsh-rp-status-toggle ~ .dsh-rp-status-toggle { margin-left: 0; }
.dsh-rp-cluster-default { margin: 20px 0 28px; padding: 18px; border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #4c7dff) 35%, transparent); border-left: 4px solid var(--dsw-alias-brand-primary, #4c7dff); border-radius: 12px; background: color-mix(in srgb, var(--dsw-alias-brand-primary, #4c7dff) 5%, var(--dsw-alias-bg-layer-1, #fffaf6)); }
.dsh-rp-cluster-default > .dsh-rp-item { padding: 12px 0 0; border: 0; background: transparent; }
.dsh-rp-cluster-scope { display: inline-block; font-size: 12px; font-weight: 600; color: var(--dsw-alias-brand-primary, #4c7dff); }
.dsh-rp-cluster-characters { padding-top: 18px; border-top: 1px solid var(--dsw-alias-border-l2, #ddd); }
.dsh-rp-cluster-characters > h4 { margin: 0 0 6px; }
/* The native search slot normally owns the auto gap. Move it before our
   injected actions so the controls form one right-aligned group. */
[data-slot="sidebar.workspaces.header.action"]:has(.dsh-rp-status-toggle) + div { margin-left: 0; }
[data-sidebar-collapsed] .dsh-rp-status-toggle { width: 36px; height: 36px; margin-left: 0; color: var(--dsw-alias-label-primary); }
[data-sidebar-collapsed] div:has(> [data-slot="sidebar.workspaces.header.action"]) { flex-direction: column; height: auto; gap: 4px; overflow: visible; }
/* \u4FA7\u8FB9\u505C\u9760\u9762\u677F\uFF1A\u4E0E\u60AC\u6D6E\u7A97\u540C\u6B3E\u4E2D\u6027\u4E3B\u9898\u5E95\uFF08--dsw-alias-* \u53D8\u91CF\uFF09\uFF0C
   \u7F8E\u5316\u5168\u90E8\u4EA4\u7ED9\u5361\u7247\u7684 CSS/HTML/\u6B63\u5219\u89C4\u5219/JS\uFF08.f \u59D4\u6258\uFF09\u2014\u2014\u7A7A\u767D\u5361\u4E5F\u5E72\u51C0\u3002 */
.dsh-rp-status-dock {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 8550;
  width: min(320px, 84vw);
  background: var(--dsw-alias-bg-layer-1, #1c1e24);
  background: rgb(from var(--dsw-alias-bg-layer-1, #1c1e24) r g b / 1);
  border-right: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  box-shadow: 6px 0 28px rgba(0,0,0,.35);
  color: var(--dsw-alias-label-primary, #e8e8ec);
  font-size: 12px; line-height: 1.6; overflow-y: auto; overflow-x: hidden;
  padding: 10px 12px 14px; container-type: inline-size; box-sizing: border-box; min-width: 0;
  display: flex; flex-direction: column;
  animation: dsh-rp-dock-in .16s ease-out;
}
@keyframes dsh-rp-dock-in { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
@container (max-width: 260px) {
  .dsh-rp-status-window .dsh-rp-status-field, .dsh-rp-status-dock .dsh-rp-status-field { display: block; }
  .dsh-rp-status-window .dsh-rp-status-options, .dsh-rp-status-dock .dsh-rp-status-options { gap: 4px; }
}
@container (min-width: 420px) {
  .dsh-rp-status-window .dsh-rp-status-options, .dsh-rp-status-dock .dsh-rp-status-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.dsh-rp-status-dock-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 6px; padding-bottom: 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.25));
}
.rp-composer-compact [data-composer-card] { gap: 4px; padding-top: 4px; }
.rp-composer-compact [data-composer-card] [data-input-scroll] { max-height: min(20vh, 160px); }
.rp-composer-compact [data-composer-input] { padding-top: 2px; padding-bottom: 2px; }
.dsh-rp-decision-mount { position: relative; height: 36px; width: 100%; min-width: 0; flex: none; z-index: 20; pointer-events: none; }
.dsh-rp-decision-backdrop {
  position: absolute; bottom: 0; display: flex; justify-content: center;
  width: 100%; background: transparent; pointer-events: none;
}
.dsh-rp-decision-card {
  box-sizing: border-box; display: flex; flex-direction: column; width: min(560px, calc(100% - 16px)); max-height: min(42vh, 380px, var(--rp-decision-visible-height, 100vh)); overflow: hidden;
  background: var(--dsw-alias-bg-layer-1, #1c1e24);
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35));
  border-radius: 12px; box-shadow: 0 6px 22px rgba(0,0,0,.24);
  padding: 8px 10px; color: var(--dsw-alias-label-primary, #e8e8ec);
  pointer-events: auto;
}
.dsh-rp-decision-card-minimized { width: auto; max-width: calc(100% - 16px); height: 36px; padding: 6px 10px; }
.dsh-rp-decision-card-minimized .dsh-rp-decision-head { margin-bottom: 0; }
.dsh-rp-decision-card-minimized .dsh-rp-decision-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh-rp-decision-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; cursor: grab; touch-action: none; user-select: none; }
.dsh-rp-decision-head:active { cursor: grabbing; }
.dsh-rp-decision-head-actions { display: inline-flex; align-items: center; gap: 2px; flex: none; }
.dsh-rp-decision-title { font-weight: 700; font-size: 14px; }
.dsh-rp-decision-question { font-size: 12.5px; color: var(--dsw-alias-label-secondary, #b8b8c2); margin-bottom: 10px; line-height: 1.5; }
.dsh-rp-decision-close { border: 0; background: transparent; color: var(--dsw-alias-label-tertiary, #9a9aa6); font-size: 18px; line-height: 1; cursor: pointer; padding: 2px 7px; border-radius: 6px; }
.dsh-rp-decision-close:hover { color: var(--dsw-alias-label-primary, #e8e8ec); background: rgba(127,127,127,.12); }
.dsh-rp-decision-options { display: flex; flex-direction: column; gap: 6px; }
.dsh-rp-decision-scroll { min-height: 0; overflow-y: auto; max-height: min(32vh, 310px); padding-right: 3px; overscroll-behavior: contain; }
.dsh-rp-decision-option {
  display: flex; align-items: flex-start; gap: 10px; width: 100%; text-align: left;
  padding: 7px 10px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28));
  background: var(--dsw-alias-bg-layer-2, #23262e);
  color: var(--dsw-alias-label-primary, #e8e8ec);
  font-size: 13px; line-height: 1.5; cursor: pointer; font-family: inherit;
  transition: border-color .12s ease, background .12s ease, transform .12s ease;
}
.dsh-rp-decision-option:hover { border-color: var(--dsw-alias-brand-primary, #4c7dff); transform: translateX(2px); }
.dsh-rp-decision-option-active { border-color: var(--dsw-alias-brand-primary, #4c7dff); background: rgba(76,125,255,.12); }
.dsh-rp-decision-key { flex: none; width: 20px; height: 20px; margin-top: 1px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; background: var(--dsw-alias-brand-primary, #4c7dff); }
.dsh-rp-decision-heart { flex: none; margin-top: 2px; font-size: 13px; }
.dsh-rp-decision-label { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dsh-rp-decision-desc { font-size: 11.5px; color: var(--dsw-alias-label-tertiary, #9a9aa6); line-height: 1.4; }
.dsh-rp-decision-confirm {
  margin-top: 10px; width: 100%; padding: 9px; border-radius: 10px; cursor: pointer; font-family: inherit;
  border: 1px solid var(--dsw-alias-brand-primary, #4c7dff);
  background: var(--dsw-alias-brand-primary, #4c7dff); color: #fff; font-size: 13px; font-weight: 600;
}
.dsh-rp-decision-confirm:disabled { opacity: .45; cursor: not-allowed; }
.dsh-rp-decision-custom { display: flex; gap: 8px; margin-top: 12px; }
.dsh-rp-decision-input {
  flex: 1; min-width: 0; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-family: inherit;
  color: var(--dsw-alias-label-primary, #e8e8ec);
  background: var(--dsw-alias-bg-layer-2, #23262e);
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28));
  outline: none;
}
.dsh-rp-decision-input:focus { border-color: var(--dsw-alias-brand-primary, #4c7dff); }
.dsh-rp-decision-send {
  flex: none; padding: 0 16px; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600;
  border: 1px solid var(--dsw-alias-brand-primary, #4c7dff);
  background: transparent; color: var(--dsw-alias-brand-primary, #4c7dff);
}
.dsh-rp-decision-send:hover { background: rgba(76,125,255,.12); }
.dsh-rp-decision-send:disabled { opacity: .45; cursor: not-allowed; }
.dsh-rp-decision-busy { opacity: .72; pointer-events: none; }
/* \u6C89\u6D78\u6A21\u5F0F\uFF1A\u9690\u85CF\u5DE5\u5177/\u5185\u90E8\u8282\u70B9\uFF0C\u6B63\u6587\u9605\u8BFB\u6392\u7248\u3002
   \u6CE8\u610F\uFF1A\u4E0D\u9690\u85CF turn-tail \u2014\u2014 \u5B83\u627F\u8F7D\u64CD\u4F5C\u884C\uFF08\u590D\u5236/\u672C\u8F6E\u7528\u91CF/\u672C\u8F6E\u7528\u65F6/\u53CD\u9988/\u89D2\u8272\u626E\u6F14\u6309\u94AE\uFF09\u3002 */
/* Native Chat owns process folding and its expandable control. Permanent
   display:none here also hid the disclosure and made its contents uninspectable. */
.rp-immersive [data-chat-flow-kind="assistant-step"] { font-size: 15px; line-height: 1.9; }
.rp-immersive [data-chat-flow-kind="user"] { font-size: 14px; opacity: .92; }
@media (max-width: 768px) {
  .dsh-rp-actions { gap: 4px; }
  .dsh-rp-btn { padding: 1px 6px; font-size: 10px; }
}
`;

// conversation-projection.js
var copy = (value) => {
  if (typeof structuredClone === "function")
    return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};
var catalogRoot = (id, catalog) => {
  const record = catalog?.schemaVersion === 1 && typeof id === "string" ? catalog.worldlines?.[id] : void 0;
  return record && typeof record.conversationId === "string" ? record.conversationId : id;
};
var validCatalog = (catalog) => !!(catalog?.schemaVersion === 1 && catalog.worldlines && catalog.conversations);
function projectConversationList(nativeState, catalog) {
  const result = { ...nativeState };
  if (!validCatalog(catalog) || !Array.isArray(nativeState?.ids) || !nativeState?.byId || typeof nativeState.byId !== "object")
    return result;
  const ids = nativeState.ids;
  const present = new Set(ids);
  const roots = /* @__PURE__ */ new Map();
  const missing = /* @__PURE__ */ new Set();
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
    projectedById[id] = summary.updatedAt === updatedAt && summary.running === running && summary.parentSessionId === parentSessionId ? summary : { ...summary, updatedAt, running, ...parentSessionId !== summary.parentSessionId ? { parentSessionId } : {} };
  }
  return { ...result, ids: projectedIds, byId: projectedById, current: catalogRoot(nativeState.current, catalog), missingConversationIds: [...missing] };
}
function projectConversationWorkspaces(nativeSnapshot, catalog) {
  const result = { ...nativeSnapshot ?? {} };
  if (!validCatalog(catalog) || !Array.isArray(nativeSnapshot?.items))
    return result;
  const assignedRoots = /* @__PURE__ */ new Set();
  const items = nativeSnapshot.items.map((item) => {
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
  return { ...result, items, ...archivedUnchanged ? {} : { archivedSessionIds: archived } };
}
function projectConversationSearch(result, catalog) {
  if (!validCatalog(catalog))
    return copy(result ?? {});
  const seen = /* @__PURE__ */ new Set(), items = [];
  for (const item of result?.items ?? []) {
    const root = catalogRoot(item.sessionId, catalog), active = resolveConversationExecution(root, catalog);
    if (active !== item.sessionId || seen.has(root))
      continue;
    seen.add(root);
    items.push(root === item.sessionId ? copy(item) : { ...copy(item), sessionId: root, executionSessionId: item.sessionId });
  }
  return { ...copy(result ?? {}), items };
}
var usableExecution = (root, candidate, catalog) => {
  if (candidate === root)
    return root;
  const record = candidate === void 0 ? void 0 : catalog.worldlines?.[candidate];
  return record?.conversationId === root && record.status === "ready" ? candidate : null;
};
function resolveConversationExecution(root, catalog) {
  if (!validCatalog(catalog) || typeof root !== "string")
    return root;
  return usableExecution(root, catalog.conversations[root]?.activeSessionId, catalog) ?? root;
}

// conversation-presentation.js
function createConversationPresentation({ React, sessionsService, toast, errorMessage: errorMessage5 }) {
  let conversationCatalog = {
    status: "loading",
    value: null,
    knownIds: [],
    error: null
  };
  const conversationListeners = /* @__PURE__ */ new Set();
  let conversationLoad = null;
  const notifyConversations = () => {
    for (const listener of conversationListeners)
      listener();
  };
  const acceptConversations = (value, knownIds = conversationCatalog.knownIds) => {
    if (value?.schemaVersion !== 1 || !value.worldlines || !value.conversations)
      return;
    if (conversationCatalog.value && value.revision !== void 0 && conversationCatalog.value.revision !== void 0 && value.revision < conversationCatalog.value.revision)
      return;
    const sorted = [...knownIds].sort();
    if (conversationCatalog.status === "ready" && conversationCatalog.value?.revision === value.revision && JSON.stringify(sorted) === JSON.stringify(conversationCatalog.knownIds))
      return;
    conversationCatalog = {
      status: "ready",
      value,
      knownIds: sorted,
      error: null
    };
    notifyConversations();
  };
  const loadConversations = async () => {
    if (conversationLoad)
      return conversationLoad;
    const knownIds = sessionsService?.list?.getSnapshot?.()?.ids ?? [];
    conversationLoad = (async () => {
      const response = await fetch("/api/roleplay/conversations"), data = await response.json();
      if (!response.ok || !data?.ok || !data.worldlines || !data.conversations)
        throw new Error("\u9152\u9986\u4F1A\u8BDD\u76EE\u5F55\u6682\u65F6\u4E0D\u53EF\u7528");
      acceptConversations(data, knownIds);
      return data;
    })().catch((error) => {
      conversationCatalog = {
        ...conversationCatalog,
        status: "error",
        error: String(errorMessage5(error))
      };
      notifyConversations();
      throw error;
    }).finally(() => {
      conversationLoad = null;
    });
    return conversationLoad;
  };
  function TavernWorkspacePresentation({ browserProps, renderDefault }) {
    const native = browserProps.useSessions((s) => s);
    const catalog = React.useSyncExternalStore(React.useCallback((listener) => {
      conversationListeners.add(listener);
      return () => conversationListeners.delete(listener);
    }, []), React.useCallback(() => conversationCatalog, []));
    const idsKey = [...native?.ids ?? []].sort().join("\0");
    const catalogReadAt = React.useRef(0);
    const catalogTrailing = React.useRef(null);
    React.useEffect(() => {
      const CATALOG_READ_MIN_INTERVAL_MS = 1e4;
      const readNow = () => {
        catalogReadAt.current = Date.now();
        void loadConversations().catch(() => {
        });
      };
      const wait = CATALOG_READ_MIN_INTERVAL_MS - (Date.now() - catalogReadAt.current);
      if (wait <= 0)
        readNow();
      else if (catalogTrailing.current === null)
        catalogTrailing.current = setTimeout(() => {
          catalogTrailing.current = null;
          readNow();
        }, wait);
      const refresh = () => {
        if (typeof document === "undefined" || !document.hidden)
          readNow();
      };
      if (typeof document !== "undefined")
        document.addEventListener("visibilitychange", refresh);
      if (typeof window !== "undefined")
        window.addEventListener("focus", refresh);
      const timer = setInterval(refresh, 3e4);
      return () => {
        clearInterval(timer);
        if (catalogTrailing.current !== null) {
          clearTimeout(catalogTrailing.current);
          catalogTrailing.current = null;
        }
        if (typeof document !== "undefined")
          document.removeEventListener("visibilitychange", refresh);
        if (typeof window !== "undefined")
          window.removeEventListener("focus", refresh);
      };
    }, [idsKey]);
    const reconciledRef = React.useRef(/* @__PURE__ */ new Set());
    React.useEffect(() => {
      if (!native.current || !catalog.value)
        return;
      const member = catalog.value.worldlines?.[native.current];
      const root = member?.conversationId ?? native.current;
      const active = resolveConversationExecution(root, catalog.value);
      const key = `${catalog.value.revision}:${root}:${native.current}:${active}`;
      if (active === native.current || reconciledRef.current.has(key))
        return;
      reconciledRef.current.add(key);
      browserProps.open(active);
    }, [native.current, catalog.value?.revision]);
    const projections = React.useRef(null);
    if (projections.current?.catalog !== catalog)
      projections.current = {
        catalog,
        lists: /* @__PURE__ */ new WeakMap(),
        workspaces: /* @__PURE__ */ new WeakMap()
      };
    if (!catalog.value)
      return React.createElement("div", {
        role: "status",
        style: {
          padding: 12
        }
      }, catalog.error ?? "\u6B63\u5728\u8BFB\u53D6\u9152\u9986\u4F1A\u8BDD\u2026", catalog.error && React.createElement("button", {
        onClick: () => void loadConversations().catch(() => {
        })
      }, "\u91CD\u8BD5"));
    const cached = (cache, value, project) => {
      let result = cache.get(value);
      if (!result) {
        result = project(value);
        cache.set(value, result);
      }
      return result;
    };
    const known = new Set(catalog.knownIds);
    const usePresentedSessions = (selector) => browserProps.useSessions((value) => selector(cached(projections.current.lists, value, (snapshot) => projectConversationList({
      ...snapshot,
      ids: (snapshot.ids ?? []).filter((id) => known.has(id))
    }, catalog.value))));
    const usePresentedWorkspaces = (selector) => browserProps.useWorkspaces((value) => selector(cached(projections.current.workspaces, value, (snapshot) => projectConversationWorkspaces(snapshot, catalog.value))));
    const executionId = (id) => resolveConversationExecution(id, catalog.value);
    return renderDefault({
      useSessions: usePresentedSessions,
      useWorkspaces: usePresentedWorkspaces,
      open: (id) => {
        void loadConversations().then((latest) => browserProps.open(resolveConversationExecution(id, latest))).catch((error) => toast(errorMessage5(error)));
      },
      forkSession: (id) => browserProps.forkSession(executionId(id)),
      searchSessions: async (...args) => projectConversationSearch(await browserProps.searchSessions(...args), conversationCatalog.value)
    });
  }
  return {
    acceptConversations,
    loadConversations,
    TavernWorkspacePresentation
  };
}

// settings-projection.js
function sortLibraryResources(resources, order = "time-desc") {
  const time = (r) => Date.parse(r.modifiedAt ?? r.updatedAt ?? r.createdAt ?? "") || 0;
  const name = (a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "zh-Hans-CN", { numeric: true }) || String(a.id).localeCompare(String(b.id));
  return [...resources].sort((a, b) => order === "name-asc" ? name(a, b) : order === "name-desc" ? -name(a, b) : (order === "time-asc" ? time(a) - time(b) : time(b) - time(a)) || name(a, b));
}
var MODEL_PURPOSE_IDS = Object.freeze(["memory", "card-import", "card-export", "status", "decision", "novel-export"]);
function buildModelSettings(allMain, routes) {
  const normalized = {};
  for (const id of MODEL_PURPOSE_IDS) {
    const route = routes?.[id];
    normalized[id] = route && typeof route.provider === "string" && typeof route.model === "string" ? { provider: route.provider, model: route.model, ...route.reasoningEffort ? { reasoningEffort: route.reasoningEffort } : {} } : null;
  }
  return { allMain: allMain === true, routes: normalized };
}
function buildReasoningEffortOptions(model, current) {
  const efforts = Array.isArray(model?.reasoning?.efforts) ? model.reasoning.efforts : [];
  const options = [{ id: "", name: model?.reasoning?.defaultEffort ? `\u6A21\u578B\u9ED8\u8BA4\uFF08${model.reasoning.defaultEffort}\uFF09` : "\u6A21\u578B\u9ED8\u8BA4" }];
  for (const effort of efforts)
    if (effort && typeof effort.id === "string")
      options.push({ id: effort.id, name: effort.name ?? effort.id, description: effort.description });
  if (current && !options.some((option) => option.id === current))
    options.push({ id: current, name: `${current}\uFF08\u672A\u77E5\uFF0C\u4FDD\u7559\uFF09`, unknown: true });
  return options;
}
function formatFallbackText(fallback) {
  if (!fallback?.from || !fallback?.to)
    return "";
  const label = (route) => `${route.provider ?? "\u672A\u77E5\u4F9B\u5E94\u5546"} ${route.model ?? "\u672A\u77E5\u6A21\u578B"}${route.reasoningEffort ? `\uFF08${route.reasoningEffort}\uFF09` : ""}`;
  const reasons = { timeout: "\u8D85\u65F6", failed: "\u5931\u8D25\uFF08\u539F\u56E0\u672A\u63D0\u4F9B\uFF09", "runtime-restart": "\u8FD0\u884C\u65F6\u91CD\u542F", unknown: "\u56DE\u9000\uFF08\u539F\u56E0\u672A\u63D0\u4F9B\uFF09" };
  const reason = fallback.failure?.category && fallback.failure.category !== "unknown" ? fallback.failure.label : reasons[fallback.reason] ?? "\u56DE\u9000\uFF08\u539F\u56E0\u672A\u63D0\u4F9B\uFF09";
  const details = [fallback.failure?.code, fallback.failure?.status ? `HTTP ${fallback.failure.status}` : null].filter(Boolean).join(" \xB7 ");
  return `${label(fallback.from)} ${reason}${details ? ` [${details}]` : ""} \u2192 ${label(fallback.to)} \u63A5\u624B`;
}
function isCardReadableResource(resource) {
  const sources = Array.isArray(resource?.sources) ? resource.sources : [resource?.source];
  if (sources.some((source) => source?.kind === "novel-export"))
    return false;
  return ["image/png", "application/json", "text/markdown", "text/plain"].includes(String(resource?.type ?? "").split(";")[0]);
}
function normalizePricingSettings(raw) {
  return {
    ...raw ?? {},
    defaultMode: raw?.defaultMode === "manual" ? "manual" : "auto",
    defaultMultiplier: raw?.defaultMultiplier ?? 1,
    autoSync: raw?.autoSync === true,
    rates: Array.isArray(raw?.rates) ? raw.rates.map((rate) => ({ ...rate, mode: rate.mode === "auto" ? "auto" : "manual", multiplier: rate.multiplier ?? null, catalogKey: rate.catalogKey ?? null })) : []
  };
}
function usageCostPresentation(scope, currency, fx) {
  const calls = Number(scope?.calls ?? 0);
  const pricedCalls = Number(scope?.pricedCalls ?? 0);
  const hasQuote = fx == null || Number.isFinite(fx.rate);
  const knownCost = typeof scope?.knownCost === "number" && Number.isFinite(scope.knownCost) ? scope.knownCost : null;
  const value = hasQuote && pricedCalls > 0 && knownCost !== null ? knownCost : hasQuote && calls === 0 ? 0 : null;
  const missing = Math.max(0, calls - pricedCalls);
  const caption = !hasQuote ? "\u7F3A\u5C11\u6C47\u7387" : calls === 0 ? "\u96F6\u8BF7\u6C42" : scope?.costComplete ? "\u5168\u90E8\u8BF7\u6C42\u5747\u6709\u5355\u4EF7\u548C\u7528\u91CF" : pricedCalls > 0 ? `\u5DF2\u77E5\u90E8\u5206 \xB7 ${missing} \u6B21\u8BF7\u6C42\u7F3A\u5C11\u5355\u4EF7\u6216\u7528\u91CF` : `${missing} \u6B21\u8BF7\u6C42\u7F3A\u5C11\u5355\u4EF7\u6216\u7528\u91CF`;
  return { value, caption };
}

// pricing-panel.js
function createPricePanel({ React, sessionDrafts, jsonFetch, toast, statTime, errorMessage: errorMessage5 }) {
  function PricePanel({ sessionId, models, onSaved }) {
    const draftKey = `${sessionId}:prices`, [data, setData] = React.useState(null), [busy, setBusy] = React.useState(false), [nativeCatalog, setNativeCatalog] = React.useState([]), [catalog, setCatalog] = React.useState({}), [entries, setEntries] = React.useState([]), [query, setQuery] = React.useState(""), [selected, setSelected] = React.useState(""), catalogRequest = React.useRef(0);
    const normalize = (raw) => normalizePricingSettings(raw);
    const change = (next) => {
      const normalized = normalize(next);
      setData(normalized);
      sessionDrafts.set(draftKey, normalized);
    };
    const loadCatalog = React.useCallback(async (search = "", keys = []) => {
      const request = ++catalogRequest.current, q = new URLSearchParams({
        sessionId,
        q: search
      });
      if (keys.length)
        q.set("keys", JSON.stringify(keys));
      const result = await jsonFetch(`/api/roleplay/price-catalog?${q}`);
      if (request !== catalogRequest.current)
        return result;
      setCatalog(result.catalog ?? {});
      setEntries(result.entries ?? []);
      return result;
    }, [sessionId]);
    React.useEffect(() => {
      let live = true;
      Promise.all([
        jsonFetch(`/api/roleplay/prices?sessionId=${encodeURIComponent(sessionId)}`),
        jsonFetch(`/api/roleplay/models?sessionId=${encodeURIComponent(sessionId)}`)
      ]).then(([p, m]) => {
        if (!live)
          return;
        const saved = sessionDrafts.get(`${sessionId}:prices`);
        setData(normalize(saved ?? p.prices));
        setNativeCatalog(m.catalog ?? []);
      }).catch((e) => toast(errorMessage5(e)));
      return () => {
        live = false;
      };
    }, [sessionId]);
    const routes = [
      ...new Map([...models ?? [], ...data?.rates ?? []].filter((r) => r?.provider && r?.model).map((r) => [
        JSON.stringify([r.provider, r.model]),
        {
          provider: r.provider,
          model: r.model
        }
      ])).values()
    ];
    const rows = [
      ...new Map([
        ...data?.rates ?? [],
        ...routes.filter((route) => !(data?.rates ?? []).some((rate) => rate.provider === route.provider && rate.model === route.model)).map((route) => ({
          ...route,
          mode: data?.defaultMode ?? "manual",
          multiplier: null,
          catalogKey: null,
          input: null,
          output: null,
          cacheRead: null,
          cacheWrite: null
        }))
      ].map((rate) => [JSON.stringify([rate.provider, rate.model]), rate])).values()
    ];
    const catalogKeys = [
      ...new Set(rows.map((route) => route.catalogKey ?? `${route.provider === "deepseek-official" ? "deepseek" : route.provider}/${route.model}`))
    ], catalogKeyToken = JSON.stringify(catalogKeys);
    React.useEffect(() => {
      const timer = setTimeout(() => loadCatalog(query, catalogKeys).catch((e) => setCatalog({
        error: errorMessage5(e)
      })), 250);
      return () => clearTimeout(timer);
    }, [query, loadCatalog, catalogKeyToken]);
    const updateRate = (route, patch) => {
      if (!data)
        return;
      const index = data.rates.findIndex((rate) => rate.provider === route.provider && rate.model === route.model);
      change({
        ...data,
        rates: index < 0 ? [
          ...data.rates,
          {
            ...route,
            mode: data.defaultMode,
            multiplier: null,
            catalogKey: null,
            input: null,
            output: null,
            cacheRead: null,
            cacheWrite: null,
            ...patch
          }
        ] : data.rates.map((rate, i) => i === index ? {
          ...rate,
          ...patch
        } : rate)
      });
    };
    const add = (raw) => {
      if (!raw || !data)
        return;
      const route = JSON.parse(raw);
      if (data.rates.some((r) => r.provider === route.provider && r.model === route.model))
        return;
      change({
        ...data,
        rates: [
          ...data.rates,
          {
            ...route,
            mode: data.defaultMode,
            multiplier: null,
            catalogKey: null,
            input: null,
            output: null,
            cacheRead: null,
            cacheWrite: null
          }
        ]
      });
      setSelected("");
    };
    const sync = async () => {
      setBusy(true);
      try {
        const result = await jsonFetch("/api/roleplay/price-catalog", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            action: "sync"
          })
        });
        setCatalog(result.catalog ?? {});
        setEntries(result.entries ?? []);
        if (result.catalog?.error)
          toast("\u76EE\u5F55\u540C\u6B65\u5931\u8D25\uFF1A" + result.catalog.error);
        else
          toast("\u76EE\u5F55\u5DF2\u540C\u6B65");
      } catch (e) {
        toast(errorMessage5(e));
      } finally {
        setBusy(false);
      }
    };
    const save = async () => {
      if (!data)
        return;
      const hasAuto = data.defaultMode === "auto" || data.rates.some((r) => r.mode === "auto");
      if (hasAuto && data.currency !== "USD") {
        toast("\u81EA\u52A8\u5B9A\u4EF7\u53EA\u652F\u6301 USD\uFF1A\u8BF7\u5148\u5207\u6362\u4E3A USD\uFF0C\u6216\u5C06\u5168\u90E8\u6A21\u578B\u6539\u4E3A\u624B\u52A8\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u4FEE\u6539\u5E01\u79CD\u6216\u6E05\u9664\u624B\u52A8\u4EF7\u683C\u3002");
        return;
      }
      setBusy(true);
      try {
        const result = await jsonFetch("/api/roleplay/prices", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            settings: data,
            expectedRevision: data.revision
          })
        });
        const next = normalize(result.prices);
        setData(next);
        sessionDrafts.delete(draftKey);
        toast("\u5B9A\u4EF7\u5DF2\u4FDD\u5B58");
        onSaved?.();
      } catch (e) {
        toast(errorMessage5(e));
      } finally {
        setBusy(false);
      }
    };
    const exact = (r) => ({
      provider: r.provider === "deepseek-official" ? "deepseek" : r.provider,
      model: r.model
    });
    const sourceLabel = (r) => {
      const match = entries.find((e) => e.key === r.catalogKey) || entries.find((e) => e.provider === exact(r).provider && e.model === exact(r).model);
      return match ? `${match.provider} / ${match.model}` : `${exact(r).provider} / ${exact(r).model}\uFF08\u672A\u5728\u76EE\u5F55\u4E2D\u786E\u8BA4\uFF09`;
    };
    if (!data)
      return React.createElement("p", {
        className: "dsh-rp-muted"
      }, "\u6B63\u5728\u8BFB\u53D6\u5B9A\u4EF7\u8BBE\u7F6E\u2026");
    return React.createElement("fieldset", {
      className: "dsh-rp-pricing",
      disabled: busy
    }, React.createElement("p", {
      className: "dsh-rp-muted"
    }, "\u81EA\u52A8\u4EF7\u683C\u6765\u81EA\u76EE\u5F55\u7684\u7CBE\u786E\u4F9B\u5E94\u5546/\u6A21\u578B\u5339\u914D\uFF0C\u91D1\u989D\u5355\u4F4D\u4E3A USD/\u767E\u4E07 tokens\u3002\u4E2D\u8F6C\u7AD9\u4E0D\u4F1A\u63A8\u65AD\u6A21\u578B\u5382\u5546\uFF1B\u65E0\u76EE\u5F55\u5339\u914D\u65F6\u663E\u793A N/A\u3002\u624B\u52A8\u4EF7\u683C\u59CB\u7EC8\u4FDD\u7559\u3002"), React.createElement("div", {
      className: "dsh-rp-pricing-grid"
    }, React.createElement("section", {
      className: "dsh-rp-pricing-card"
    }, React.createElement("h5", null, "\u9ED8\u8BA4\u89C4\u5219"), React.createElement("label", null, "\u5E01\u79CD ", React.createElement("select", {
      value: data.currency ?? "USD",
      onChange: (e) => change({
        ...data,
        currency: e.target.value
      })
    }, ["USD", "CNY", "EUR", "JPY", "HKD"].map((v) => React.createElement("option", {
      key: v,
      value: v
    }, v)))), React.createElement("label", null, "\u9ED8\u8BA4\u6A21\u5F0F ", React.createElement("select", {
      value: data.defaultMode,
      onChange: (e) => change({
        ...data,
        defaultMode: e.target.value
      })
    }, React.createElement("option", {
      value: "auto"
    }, "\u81EA\u52A8\u76EE\u5F55"), React.createElement("option", {
      value: "manual"
    }, "\u624B\u52A8\u5355\u4EF7"))), React.createElement("label", null, "\u9ED8\u8BA4\u500D\u7387 ", React.createElement("input", {
      type: "number",
      min: 0,
      step: "any",
      value: data.defaultMultiplier ?? 1,
      onChange: (e) => change({
        ...data,
        defaultMultiplier: e.target.value === "" ? 1 : Number(e.target.value)
      })
    })), React.createElement("label", {
      className: "dsh-rp-row"
    }, React.createElement("input", {
      type: "checkbox",
      checked: data.autoSync === true,
      onChange: (e) => change({
        ...data,
        autoSync: e.target.checked
      })
    }), "\u81EA\u52A8\u540C\u6B65\u76EE\u5F55")), React.createElement("section", {
      className: "dsh-rp-pricing-card"
    }, React.createElement("h5", null, "\u81EA\u52A8\u76EE\u5F55"), React.createElement("div", {
      className: "dsh-rp-muted"
    }, `\u6765\u6E90\uFF1A${catalog.source ?? "\u672A\u540C\u6B65"} \xB7 ${catalog.fetchedAt ? statTime(catalog.fetchedAt) : "\u5C1A\u65E0\u66F4\u65B0\u65F6\u95F4"} \xB7 ${catalog.count ?? entries.length ?? 0} \u9879`), catalog.stale ? React.createElement("div", {
      className: "dsh-rp-error"
    }, "\u76EE\u5F55\u7F13\u5B58\u5DF2\u8FC7\u671F\uFF1B\u53EF\u7EE7\u7EED\u4F7F\u7528\u65E7\u7F13\u5B58\u6216\u7ACB\u5373\u540C\u6B65\u3002") : null, catalog.error ? React.createElement("div", {
      className: "dsh-rp-error"
    }, catalog.error) : null, React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("input", {
      placeholder: "\u641C\u7D22\u76EE\u5F55\u6A21\u578B",
      value: query,
      onChange: (e) => setQuery(e.target.value)
    }), React.createElement("button", {
      className: "dsh-rp-btn",
      onClick: sync
    }, catalog.syncing ? "\u540C\u6B65\u4E2D\u2026" : "\u7ACB\u5373\u540C\u6B65")))), data.currency !== "USD" && (data.defaultMode === "auto" || data.rates.some((r) => r.mode === "auto")) ? React.createElement("div", {
      className: "dsh-rp-error",
      role: "alert"
    }, "\u81EA\u52A8\u5B9A\u4EF7\u53EA\u652F\u6301 USD\u3002\u8BF7\u5207\u6362\u4E3A USD\uFF0C\u6216\u628A\u5168\u90E8\u6A21\u578B\u8BBE\u4E3A\u624B\u52A8\uFF1B\u4FDD\u5B58\u4E0D\u4F1A\u9690\u5F0F\u4FEE\u6539\u5E01\u79CD\u6216\u6E05\u9664\u624B\u52A8\u4EF7\u683C\u3002") : null, React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("select", {
      "aria-label": "\u6DFB\u52A0\u5B9A\u4EF7\u6A21\u578B",
      value: selected,
      onChange: (e) => setSelected(e.target.value)
    }, React.createElement("option", {
      value: ""
    }, "\u4ECE\u5F53\u524D\u6A21\u578B\u6216\u539F\u751F\u76EE\u5F55\u6DFB\u52A0\u2026"), [
      ...new Map([...routes, ...nativeCatalog].filter((r) => r?.provider && r?.model).map((r) => [JSON.stringify([r.provider, r.model]), r])).values()
    ].map((r) => React.createElement("option", {
      key: JSON.stringify(r),
      value: JSON.stringify({
        provider: r.provider,
        model: r.model
      })
    }, `${r.provider} / ${r.model}`))), React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: !selected,
      onClick: () => add(selected)
    }, "\u6DFB\u52A0\u6A21\u578B")), React.createElement("div", {
      className: "dsh-rp-pricing-list"
    }, rows.map((r) => React.createElement("section", {
      className: "dsh-rp-pricing-card",
      key: JSON.stringify([r.provider, r.model])
    }, React.createElement("div", {
      className: "dsh-rp-item-head"
    }, React.createElement("div", null, React.createElement("strong", null, r.model), React.createElement("div", {
      className: "dsh-rp-muted"
    }, r.provider)), React.createElement("select", {
      "aria-label": `${r.model} \u5B9A\u4EF7\u6A21\u5F0F`,
      value: r.mode,
      onChange: (e) => updateRate(r, {
        mode: e.target.value
      })
    }, React.createElement("option", {
      value: "auto"
    }, "\u81EA\u52A8"), React.createElement("option", {
      value: "manual"
    }, "\u624B\u52A8"))), r.mode === "auto" ? React.createElement("div", {
      className: "dsh-rp-pricing-auto"
    }, React.createElement("label", null, "\u76EE\u5F55\u6765\u6E90 ", React.createElement("select", {
      value: r.catalogKey ?? "",
      onChange: (e) => updateRate(r, {
        catalogKey: e.target.value || null
      })
    }, React.createElement("option", {
      value: ""
    }, sourceLabel(r)), entries.map((entry) => React.createElement("option", {
      key: entry.key,
      value: entry.key
    }, `${entry.provider} / ${entry.model}`)))), React.createElement("label", null, "\u500D\u7387 ", React.createElement("input", {
      type: "number",
      min: 0,
      step: "any",
      placeholder: `\u9ED8\u8BA4 ${data.defaultMultiplier ?? 1}`,
      value: r.multiplier ?? "",
      onChange: (e) => updateRate(r, {
        multiplier: e.target.value === "" ? null : Number(e.target.value)
      })
    })), React.createElement("div", {
      className: "dsh-rp-muted"
    }, r.catalogKey ? "\u4F7F\u7528\u6307\u5B9A\u76EE\u5F55\u9879\uFF1B\u7A7A\u503C\u6309\u7CBE\u786E provider/model \u67E5\u627E\u3002" : "\u7A7A\u76EE\u5F55\u9879\u4F1A\u6309\u7CBE\u786E provider/model \u5339\u914D\uFF1Bdeepseek-official \u4EC5\u6620\u5C04\u4E3A deepseek\u3002")) : React.createElement("div", {
      className: "dsh-rp-pricing-manual"
    }, ["input", "output", "cacheRead", "cacheWrite"].map((field) => React.createElement("label", {
      key: field
    }, {
      input: "\u8F93\u5165",
      output: "\u8F93\u51FA",
      cacheRead: "\u7F13\u5B58\u547D\u4E2D",
      cacheWrite: "\u7F13\u5B58\u5199\u5165"
    }[field], React.createElement("input", {
      type: "number",
      min: 0,
      step: "any",
      placeholder: "N/A",
      value: r[field] ?? "",
      onChange: (e) => updateRate(r, {
        [field]: e.target.value === "" ? null : Number(e.target.value)
      })
    }))))))), React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("button", {
      className: "dsh-rp-btn dsh-rp-primary",
      onClick: save
    }, busy ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u5B9A\u4EF7\u8BBE\u7F6E")));
  }
  return PricePanel;
}

// telemetry-panels.js
var errorMessage = (error) => String(error && typeof error === "object" && "message" in error ? error.message : error);
function createTelemetryPanels({ React, sessionDrafts, jsonFetch, toast }) {
  const telemetryStatus = {
    completed: "\u6210\u529F",
    failed: "\u5931\u8D25",
    cancelled: "\u5DF2\u53D6\u6D88",
    truncated: "\u8F93\u51FA\u622A\u65AD",
    unknown: "\u7ED3\u679C\u672A\u77E5",
    interrupted: "\u8FD0\u884C\u4E2D\u65AD",
    running: "\u8FD0\u884C\u4E2D",
    queued: "\u6392\u961F\u4E2D",
    "waiting-main": "\u7B49\u5F85\u4E3B\u6A21\u578B",
    stale: "\u6765\u6E90\u5DF2\u53D8\u5316"
  };
  const telemetryKind = {
    character: "\u89D2\u8272\u63A8\u6F14",
    model: "\u6A21\u578B\u8C03\u7528",
    narrative: "\u6B63\u6587\u751F\u6210",
    subagent: "\u5B50\u4EE3\u7406",
    tool: "\u5DE5\u5177\u8C03\u7528",
    turn: "\u8F6E\u6B21\u7ED3\u675F",
    memory: "\u8BB0\u5FC6\u6574\u7406",
    status: "\u72B6\u6001\u680F",
    decision: "\u51B3\u7B56\u5EFA\u8BAE",
    embedding: "\u5411\u91CF\u5D4C\u5165",
    "card-import": "\u8BFB\u5361",
    "card-export": "\u89D2\u8272\u5361\u5BFC\u51FA",
    "novel-export": "\u5C0F\u8BF4\u5BFC\u51FA",
    "session-title": "\u4F1A\u8BDD\u6807\u9898",
    compaction: "\u8BB0\u5FC6\u538B\u7F29",
    management: "\u7BA1\u7406\u4EFB\u52A1",
    "after-story": "\u8F6E\u672B\u7EF4\u62A4",
    "before-story": "\u6B63\u6587\u51C6\u5907"
  };
  const numberFormatter = new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 6
  });
  const statNumber = (value) => value == null ? "N/A" : numberFormatter.format(value);
  const statTime = (value) => value == null ? "N/A" : new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
  const PricePanel = createPricePanel({
    React,
    sessionDrafts,
    jsonFetch,
    toast,
    statTime,
    errorMessage
  });
  function panelRange(preset, custom) {
    const now = /* @__PURE__ */ new Date(), to = now.getTime();
    let from;
    if (preset === "custom")
      return {
        from: new Date(custom.from).getTime(),
        to: new Date(custom.to).getTime()
      };
    if (preset === "all")
      from = 0;
    else if (preset === "week") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (start.getDay() + 6) % 7);
      from = start.getTime();
    } else if (preset === "month")
      from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    else if (preset === "year")
      from = new Date(now.getFullYear(), 0, 1).getTime();
    else
      from = to - ({
        "1h": 36e5,
        "24h": 864e5,
        "3d": 2592e5
      }[preset] ?? 864e5);
    return {
      from,
      to
    };
  }
  function UsageChart({ data }) {
    const points = data?.timeline ?? [], series = [
      ["inputTokens", "\u8F93\u5165", "#4085f4"],
      ["outputTokens", "\u8F93\u51FA", "#14a87b"],
      ["cacheReadTokens", "\u7F13\u5B58\u547D\u4E2D", "#9b66e8"]
    ];
    if (!points.length)
      return React.createElement("div", {
        className: "dsh-rp-empty"
      }, "\u8FD9\u4E2A\u65F6\u95F4\u6BB5\u8FD8\u6CA1\u6709\u8C03\u7528\u8BB0\u5F55");
    const max = Math.max(1, ...points.flatMap((p) => series.map(([key]) => p[key]))), left = 46, right = 714, top = 18, bottom = 175, first = points[0].at, last = points.at(-1).at;
    const x = (p) => left + (p.at - first) / Math.max(1, last - first) * (right - left), y = (value) => bottom - value / max * (bottom - top);
    return React.createElement("section", {
      className: "dsh-rp-stat-chart"
    }, React.createElement("div", {
      className: "dsh-rp-section-title"
    }, "\u7528\u91CF\u8D8B\u52BF"), React.createElement("svg", {
      viewBox: "0 0 740 218",
      role: "img",
      "aria-label": "\u6A21\u578B\u8F93\u5165\u3001\u8F93\u51FA\u4E0E\u7F13\u5B58\u547D\u4E2D tokens \u8D8B\u52BF"
    }, [0, 0.5, 1].map((r) => React.createElement("g", {
      key: r
    }, React.createElement("line", {
      x1: left,
      x2: right,
      y1: y(max * r),
      y2: y(max * r),
      stroke: "currentColor",
      opacity: 0.1
    }), React.createElement("text", {
      x: 40,
      y: y(max * r) + 4,
      textAnchor: "end",
      fill: "currentColor",
      fontSize: 10
    }, Intl.NumberFormat("zh-CN", {
      notation: "compact",
      maximumFractionDigits: 1
    }).format(max * r)))), series.map(([key, label, color]) => React.createElement("g", {
      key
    }, React.createElement("polyline", {
      points: points.map((p) => `${x(p)},${y(p[key])}`).join(" "),
      fill: "none",
      stroke: color,
      strokeWidth: 2.5
    }), points.map((p) => React.createElement("circle", {
      key: p.at,
      cx: x(p),
      cy: y(p[key]),
      r: 3,
      fill: color
    }, React.createElement("title", null, `${statTime(p.at)} \xB7 ${label} ${statNumber(p[key])}`))))), React.createElement("text", {
      x: left,
      y: 204,
      fill: "currentColor",
      fontSize: 10
    }, statTime(first)), React.createElement("text", {
      x: right,
      y: 204,
      textAnchor: "end",
      fill: "currentColor",
      fontSize: 10
    }, statTime(last))), React.createElement("div", {
      className: "dsh-rp-chart-legend"
    }, series.map(([key, label, color]) => React.createElement("span", {
      key,
      style: {
        color
      }
    }, `\u25CF ${label}`))));
  }
  function TelemetryPanel({ sessionId, mode }) {
    const [preset, setPreset] = React.useState("24h"), [scope, setScope] = React.useState("current"), [custom, setCustom] = React.useState({
      from: "",
      to: ""
    }), [model, setModel] = React.useState(""), [kind, setKind] = React.useState(""), [usageKind, setUsageKind] = React.useState("all"), [status, setStatus] = React.useState(""), [offset, setOffset] = React.useState(0), [data, setData] = React.useState(null), [error, setError] = React.useState(""), [busy, setBusy] = React.useState(false), [revision, setRevision] = React.useState(0), [customApplied, setCustomApplied] = React.useState(null), [usageCurrency, setUsageCurrency] = React.useState(() => {
      try {
        return localStorage.getItem("dsh-roleplay-usage-currency") === "CNY" ? "CNY" : "USD";
      } catch {
        return "USD";
      }
    }), [fxBusy, setFxBusy] = React.useState(false), [usageTab, setUsageTab] = React.useState("models"), [requests, setRequests] = React.useState(null), [requestBusy, setRequestBusy] = React.useState(false);
    React.useEffect(() => {
      let live = true;
      const controller = new AbortController();
      setBusy(true);
      setError("");
      const range = preset === "custom" ? customApplied : panelRange(preset, custom);
      if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to) || range.from >= range.to) {
        setBusy(false);
        return () => controller.abort();
      }
      const q = new URLSearchParams({
        sessionId,
        scope: scope === "all" ? "all" : "session",
        from: String(range.from),
        to: String(range.to),
        offset: String(offset),
        limit: String(50)
      });
      if (scope !== "all" && scope !== "current")
        q.set("targetSessionId", scope);
      if (mode === "usage" && usageKind !== "all")
        q.set("kind", usageKind);
      if (mode === "usage")
        q.set("currency", usageCurrency);
      if (model) {
        const r = JSON.parse(model);
        q.set("provider", r.provider);
        q.set("model", r.model);
      }
      if (kind)
        q.set("kind", kind);
      if (status)
        q.set("status", status);
      jsonFetch(`/api/roleplay/${mode === "usage" ? "usage" : "logs"}?${q}`, {
        signal: controller.signal
      }).then((value) => {
        if (live)
          setData(value);
      }).catch((e) => {
        if (live)
          setError(errorMessage(e));
      }).finally(() => {
        if (live)
          setBusy(false);
      });
      return () => {
        live = false;
        controller.abort();
      };
    }, [
      sessionId,
      mode,
      preset,
      scope,
      model,
      kind,
      usageKind,
      status,
      offset,
      revision,
      customApplied,
      usageCurrency
    ]);
    React.useEffect(() => {
      if (mode !== "usage" || usageTab !== "requests")
        return;
      let live = true;
      const controller = new AbortController(), range = preset === "custom" ? customApplied : panelRange(preset, custom);
      if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to) || range.from >= range.to)
        return () => controller.abort();
      const q = new URLSearchParams({
        sessionId,
        scope: scope === "all" ? "all" : "session",
        from: String(range.from),
        to: String(range.to),
        offset: String(offset),
        limit: String(50),
        currency: usageCurrency
      });
      if (scope !== "all" && scope !== "current")
        q.set("targetSessionId", scope);
      if (model) {
        const route = JSON.parse(model);
        q.set("provider", route.provider);
        q.set("model", route.model);
      }
      if (usageKind !== "all")
        q.set("kind", usageKind);
      setRequestBusy(true);
      jsonFetch(`/api/roleplay/usage-requests?${q}`, {
        signal: controller.signal
      }).then((value) => {
        if (live)
          setRequests(value);
      }).catch((e) => {
        if (live)
          setRequests({
            error: errorMessage(e),
            rows: []
          });
      }).finally(() => {
        if (live)
          setRequestBusy(false);
      });
      return () => {
        live = false;
        controller.abort();
      };
    }, [sessionId, mode, usageTab, preset, scope, model, usageKind, offset, revision, customApplied, usageCurrency]);
    React.useEffect(() => {
      if (mode === "usage")
        setOffset(0);
    }, [sessionId, mode, preset, scope, model, usageKind, customApplied, usageCurrency]);
    React.useEffect(() => {
      if (mode !== "logs")
        return;
      const timer = setInterval(() => setRevision((v) => v + 1), 1e4);
      return () => clearInterval(timer);
    }, [mode]);
    React.useEffect(() => {
      if (!data?.coverage?.scanning && !data?.fx?.syncing)
        return;
      const timer = setInterval(() => setRevision((v) => v + 1), 3e3);
      return () => clearInterval(timer);
    }, [data?.coverage?.scanning, data?.fx?.syncing]);
    const setDisplayCurrency = (next) => {
      setUsageCurrency(next);
      try {
        localStorage.setItem("dsh-roleplay-usage-currency", next);
      } catch {
      }
    };
    const syncFx = async () => {
      setFxBusy(true);
      try {
        const result = await jsonFetch("/api/roleplay/exchange-rate", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            action: "sync"
          })
        });
        setRevision((v) => v + 1);
        if (result.fx?.error)
          toast("\u6C47\u7387\u66F4\u65B0\u5931\u8D25\uFF1A" + result.fx.error);
        else
          toast("\u6C47\u7387\u5DF2\u66F4\u65B0");
      } catch (e) {
        toast(errorMessage(e));
      } finally {
        setFxBusy(false);
      }
    };
    const select = (label, value, handler, options) => React.createElement("label", {
      className: "dsh-rp-filter"
    }, React.createElement("span", null, label), React.createElement("select", {
      "aria-label": label,
      value,
      onChange: (e) => {
        handler(e.target.value);
        setOffset(0);
      }
    }, options.map(([v, t]) => React.createElement("option", {
      key: v,
      value: v
    }, t))));
    const total = data?.totals;
    const metric = (label, value, caption, note) => React.createElement("div", {
      className: "dsh-rp-metric",
      key: label
    }, React.createElement("span", null, label), React.createElement("strong", null, value), caption ? React.createElement("small", null, caption) : null, note ? React.createElement("small", {
      className: "dsh-rp-muted"
    }, note) : null);
    const tokenValue = (scope2, field) => statNumber(scope2?.[field] ?? 0);
    const tokenNote = (scope2, field) => {
      const missing = Number(scope2?.unknownFields?.[field] ?? 0);
      return missing > 0 ? `${missing} \u6B21\u8BF7\u6C42\u7F3A\u5C11${{
        inputTokens: "\u8F93\u5165",
        outputTokens: "\u8F93\u51FA",
        cacheReadTokens: "\u7F13\u5B58\u8BFB\u53D6",
        cacheWriteTokens: "\u7F13\u5B58\u5199\u5165",
        totalTokens: "\u603B"
      }[field] ?? field}\u7528\u91CF` : null;
    };
    const rateValue = (rate) => rate == null ? "\u2014" : `${(rate * 100).toFixed(1)}%`;
    const rateNote = (scope2) => {
      const incomplete = Number(scope2?.cacheRateIncompleteCalls ?? 0);
      return incomplete > 0 ? `\u7F13\u5B58\u547D\u4E2D\u7387\u6392\u9664 ${incomplete} \u6B21\u7F3A\u5C11\u5B8C\u6574\u8F93\u5165\u6216\u7F13\u5B58\u6570\u636E\u7684\u8BF7\u6C42` : scope2?.cacheHitRate == null || !((scope2?.cacheRateCalls ?? 0) > 0) ? "\u6682\u65E0\u6570\u636E" : null;
    };
    const costView = (scope2) => usageCostPresentation(scope2, data?.currency, data?.fx);
    const aggregateUsageRow = (r, providerOnly = false) => {
      const cost = costView(r);
      const embeddingView = usageKind === "embedding";
      return React.createElement("tr", {
        key: JSON.stringify([r.provider, r.model])
      }, React.createElement("td", null, providerOnly ? React.createElement("strong", null, r.provider ?? "\u672A\u77E5\u4F9B\u5E94\u5546") : React.createElement(React.Fragment, null, React.createElement("strong", null, r.model ?? "\u672A\u77E5\u6A21\u578B"), React.createElement("div", {
        className: "dsh-rp-muted"
      }, r.provider ?? "\u672A\u77E5\u4F9B\u5E94\u5546"))), React.createElement("td", null, r.calls), React.createElement("td", null, tokenValue(r, "inputTokens"), tokenNote(r, "inputTokens") ? React.createElement("small", {
        className: "dsh-rp-muted"
      }, tokenNote(r, "inputTokens")) : null), React.createElement("td", null, embeddingView ? "\u4E0D\u9002\u7528" : tokenValue(r, "outputTokens"), !embeddingView && tokenNote(r, "outputTokens") ? React.createElement("small", {
        className: "dsh-rp-muted"
      }, tokenNote(r, "outputTokens")) : null), React.createElement("td", null, embeddingView ? "\u4E0D\u9002\u7528" : rateValue(r.cacheHitRate), embeddingView ? null : React.createElement("small", {
        className: "dsh-rp-muted"
      }, `\u547D\u4E2D ${tokenValue(r, "cacheReadTokens")} tokens${rateNote(r) ? " \xB7 " + rateNote(r) : ""}`)), React.createElement("td", null, cost.value === null ? "N/A" : `${data?.currency} ${statNumber(cost.value)}`, React.createElement("small", {
        className: "dsh-rp-muted"
      }, cost.caption)), React.createElement("td", null, `${Math.round(r.successes / Math.max(1, r.calls) * 100)}%`), React.createElement("td", null, r.timedCalls ? `${(r.durationMs / r.timedCalls / 1e3).toFixed(2)}s` : "\u2014"), React.createElement("td", null, embeddingView ? "\u4E0D\u9002\u7528" : r.tokensPerSecond == null ? "\u2014" : `${Number(r.tokensPerSecond).toFixed(1)} tok/s`, embeddingView ? null : r.speedCalls ? React.createElement("small", {
        className: "dsh-rp-muted"
      }, `${r.speedCalls} \u6B21\u6709\u6548\u751F\u6210`) : React.createElement("small", {
        className: "dsh-rp-muted"
      }, "\u7F3A\u5C11\u6570\u636E")));
    };
    const modelUsageRow = (r) => aggregateUsageRow(r);
    const providerUsageRow = (r) => aggregateUsageRow(r, true);
    const pricingNote = (status2) => ({
      "missing-catalog": "\u7F3A\u5C11\u76EE\u5F55\u4EF7\u683C",
      "missing-manual": "\u5C1A\u672A\u8BBE\u7F6E\u5355\u4EF7",
      "missing-usage": "\u7F3A\u5C11\u7528\u91CF\u6570\u636E",
      "missing-exchange-rate": "\u7F3A\u5C11\u6C47\u7387",
      "unknown-context-tier": "\u7F3A\u5C11\u5206\u6863\u8BA1\u4EF7\u6240\u9700\u7528\u91CF",
      "unsupported-tier": "\u6682\u4E0D\u652F\u6301\u6B64\u4EF7\u683C\u5206\u6863",
      "missing-cacheRead-rate": "\u7F3A\u5C11\u7F13\u5B58\u547D\u4E2D\u5355\u4EF7",
      "missing-cacheWrite-rate": "\u7F3A\u5C11\u7F13\u5B58\u521B\u5EFA\u5355\u4EF7",
      "missing-input-rate": "\u7F3A\u5C11\u8F93\u5165\u5355\u4EF7",
      "missing-output-rate": "\u7F3A\u5C11\u8F93\u51FA\u5355\u4EF7"
    })[status2] ?? "\u7F3A\u5C11\u5355\u4EF7\u6216\u7528\u91CF";
    const requestUsageRow = (r) => {
      const embedding = r.kind === "embedding" || usageKind === "embedding";
      const purposeLabel = {
        index: "\u5411\u91CF\u7D22\u5F15",
        query: "\u5411\u91CF\u67E5\u8BE2",
        test: "\u63A5\u5165\u6D4B\u8BD5"
      }[r.purpose ?? ""] ?? "\u5411\u91CF\u5D4C\u5165";
      const providerUsage = r.providerUsage ? Object.entries(r.providerUsage).map(([key, value]) => `${key}=${String(value)}`).join(" \xB7 ") : "";
      return React.createElement("tr", {
        key: r.id
      }, React.createElement("td", null, statTime(r.startedAt)), React.createElement("td", null, React.createElement("strong", null, r.model ?? "\u672A\u77E5\u6A21\u578B"), React.createElement("div", {
        className: "dsh-rp-muted"
      }, r.provider ?? "\u672A\u77E5\u4F9B\u5E94\u5546"), embedding ? React.createElement("small", {
        className: "dsh-rp-muted"
      }, purposeLabel) : null), React.createElement("td", null, r.usage ? `${statNumber(r.usage.inputTokens)} / ${statNumber(r.usage.cacheReadTokens)}` : "N/A"), React.createElement("td", null, embedding ? "\u4E0D\u9002\u7528" : r.usage ? statNumber(r.usage.outputTokens) : "N/A"), React.createElement("td", null, r.cost == null ? "N/A" : `${requests?.currency ?? data?.currency ?? ""} ${statNumber(r.cost)}`, r.cost == null ? React.createElement("small", {
        className: "dsh-rp-muted"
      }, pricingNote(r.pricingStatus)) : null), React.createElement("td", null, `${r.durationMs == null ? "\u2014" : (r.durationMs / 1e3).toFixed(2) + "s"} / ${embedding ? "\u4E0D\u9002\u7528" : r.firstTokenMs == null ? "\u2014" : (r.firstTokenMs / 1e3).toFixed(2) + "s"}`), React.createElement("td", null, React.createElement("span", {
        className: `dsh-rp-status-badge dsh-rp-state-${r.status}`
      }, telemetryStatus[r.status] ?? r.status ?? "\u672A\u77E5"), r.error ? React.createElement("small", {
        className: "dsh-rp-muted"
      }, r.error) : null), React.createElement("td", null, r.sessionLabel ?? r.ownerSessionId ?? "\u2014", providerUsage ? React.createElement("small", {
        className: "dsh-rp-muted"
      }, `providerUsage: ${providerUsage}`) : null));
    };
    return React.createElement("div", {
      className: "dsh-rp-panel dsh-rp-telemetry"
    }, React.createElement("div", {
      className: "dsh-rp-section-title"
    }, mode === "usage" ? "\u4F7F\u7528\u7EDF\u8BA1" : "\u8FD0\u884C\u65E5\u5FD7"), React.createElement("p", {
      className: "dsh-rp-muted"
    }, mode === "usage" ? "\u6309\u771F\u5B9E\u8BF7\u6C42\u7EDF\u8BA1\uFF0C\u5305\u542B\u91CD\u65B0\u751F\u6210\u3001\u91CD\u8BD5\u3001\u5931\u8D25\u8C03\u7528\u53CA\u8F85\u52A9\u5B50\u4EE3\u7406\u3002\u8F93\u5165\u4E0E\u7F13\u5B58\u5206\u5F00\u8BA1\u7B97\u3002" : "\u67E5\u770B\u8FD0\u884C\u72B6\u6001\u4E0E\u8BCA\u65AD\u4FE1\u606F\u3002\u8FD9\u91CC\u4E0D\u5C55\u793A\u6B63\u6587\u3001\u601D\u8003\u3001\u5DE5\u5177\u53C2\u6570\u6216\u5BC6\u94A5\u3002"), React.createElement("div", {
      className: "dsh-rp-filters"
    }, select("\u8303\u56F4", scope, setScope, [
      ["current", "\u5F53\u524D\u4F1A\u8BDD\uFF08\u542B\u5B50\u4EE3\u7406\uFF09"],
      ["all", "\u5168\u90E8\u89D2\u8272\u626E\u6F14\u4F1A\u8BDD"],
      ...(data?.sessions ?? []).filter((s) => s.id !== sessionId).map((s) => [s.id, s.label])
    ]), select("\u65F6\u95F4", preset, setPreset, [
      ["1h", "1\u5C0F\u65F6"],
      ["24h", "24\u5C0F\u65F6"],
      ["3d", "\u4E09\u5929"],
      ["week", "\u672C\u5468"],
      ["month", "\u672C\u6708"],
      ["year", "\u4ECA\u5E74"],
      ["all", "\u5168\u90E8"],
      ["custom", "\u81EA\u5B9A\u4E49"]
    ]), mode === "usage" ? React.createElement(React.Fragment, null, select("\u8BF7\u6C42\u7C7B\u578B", usageKind, (value) => setUsageKind(value), [["all", "\u5168\u90E8"], ["generation", "\u6587\u672C\u751F\u6210"], ["embedding", "\u5411\u91CF\u5D4C\u5165"]]), select("\u5C55\u793A\u5E01\u79CD", usageCurrency, setDisplayCurrency, [["USD", "USD"], ["CNY", "\u4EBA\u6C11\u5E01 CNY"]]), select("\u6A21\u578B", model, setModel, [
      ["", "\u5168\u90E8\u6A21\u578B"],
      ...(data?.models ?? []).map((r) => [
        JSON.stringify({
          provider: r.provider,
          model: r.model
        }),
        `${r.provider ?? "\u672A\u77E5"} / ${r.model ?? "\u672A\u77E5"}`
      ])
    ])) : React.createElement(React.Fragment, null, select("\u7C7B\u578B", kind, setKind, [["", "\u5168\u90E8\u7C7B\u578B"], ...Object.entries(telemetryKind).map(([k, v]) => [k, v])]), select("\u72B6\u6001", status, setStatus, [["", "\u5168\u90E8\u72B6\u6001"], ...Object.entries(telemetryStatus).map(([k, v]) => [k, v])])), React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: busy,
      onClick: () => setRevision((v) => v + 1)
    }, busy ? "\u8BFB\u53D6\u4E2D\u2026" : "\u5237\u65B0")), preset === "custom" ? React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("input", {
      type: "datetime-local",
      "aria-label": "\u5F00\u59CB\u65F6\u95F4",
      value: custom.from,
      onChange: (e) => setCustom({
        ...custom,
        from: e.target.value
      })
    }), React.createElement("span", null, "\u81F3"), React.createElement("input", {
      type: "datetime-local",
      "aria-label": "\u7ED3\u675F\u65F6\u95F4",
      value: custom.to,
      onChange: (e) => setCustom({
        ...custom,
        to: e.target.value
      })
    }), React.createElement("button", {
      className: "dsh-rp-btn",
      onClick: () => {
        const r = panelRange("custom", custom);
        if (!Number.isFinite(r.from) || !Number.isFinite(r.to) || r.from >= r.to) {
          toast("\u8BF7\u9009\u62E9\u6709\u6548\u65F6\u95F4\u8303\u56F4");
          return;
        }
        setCustomApplied(r);
        setOffset(0);
      }
    }, "\u5E94\u7528")) : null, error ? React.createElement("div", {
      className: "dsh-rp-error",
      role: "alert"
    }, error) : null, data?.coverage?.scanning ? React.createElement("div", {
      className: "dsh-rp-scan-progress",
      role: "status"
    }, `\u6B63\u5728\u56DE\u586B\u5386\u53F2\u8BB0\u5F55 \xB7 ${data.coverage.scannedSessions ?? 0}/${data.coverage.totalSessions ?? 0} \u4E2A\u4F1A\u8BDD\u3002\u5F53\u524D\u6570\u5B57\u5C1A\u4E0D\u5B8C\u6574\uFF0C\u5B8C\u6210\u540E\u81EA\u52A8\u66F4\u65B0\u3002`) : null, data?.fx && mode === "usage" ? React.createElement("div", {
      className: "dsh-rp-row dsh-rp-muted"
    }, React.createElement("span", null, `\u6C47\u7387\u6765\u6E90\uFF1A${data.fx.source ?? "\u672A\u77E5"} \xB7 \u66F4\u65B0\u65F6\u95F4\uFF1A${data.fx.rateAt ? statTime(data.fx.rateAt) : data.fx.fetchedAt ? statTime(data.fx.fetchedAt) : "\u672A\u77E5"}${data.fx.stale ? " \xB7 \u7F13\u5B58\u5DF2\u8FC7\u671F\uFF0C\u7EE7\u7EED\u663E\u793A\u4E0A\u6B21\u6210\u529F\u7ED3\u679C" : ""}${data.fx.syncing ? " \xB7 \u6B63\u5728\u66F4\u65B0\u2026" : ""} \xB7 `), React.createElement("a", {
      href: "https://www.exchangerate-api.com",
      target: "_blank",
      rel: "noreferrer"
    }, "Rates By Exchange Rate API"), React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: fxBusy || data.fx.syncing,
      onClick: syncFx
    }, fxBusy || data.fx.syncing ? "\u66F4\u65B0\u4E2D\u2026" : "\u66F4\u65B0\u6C47\u7387")) : null, data?.fx?.error ? React.createElement("div", {
      className: "dsh-rp-error"
    }, data.fx.error) : null, data?.fx && data.fx.rate == null && data.currency === "CNY" ? React.createElement("div", {
      className: "dsh-rp-error"
    }, "\u7F3A\u5C11 USD/CNY \u6C47\u7387\uFF0C\u6210\u672C\u663E\u793A N/A\uFF1B\u5DF2\u4FDD\u7559\u4E0A\u6B21\u6210\u529F\u7ED3\u679C\u3002") : null, data?.coverage?.failedSessions ? React.createElement("div", {
      className: "dsh-rp-error"
    }, `${data.coverage.failedSessions} \u4E2A\u5386\u53F2\u6765\u6E90\u8BFB\u53D6\u5931\u8D25\uFF0C\u5F53\u524D\u7EDF\u8BA1\u4E0D\u5B8C\u6574\uFF1B\u53EF\u5237\u65B0\u91CD\u8BD5\u3002`) : null, data?.coverage?.persistenceFailures ? React.createElement("div", {
      className: "dsh-rp-error"
    }, "\u90E8\u5206\u8C03\u7528\u8BB0\u5F55\u5199\u5165\u5931\u8D25\uFF0C\u7EDF\u8BA1\u53EF\u80FD\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5668\u5B58\u50A8\u3002") : null, data?.coverage?.unattributedCalls ? React.createElement("p", {
      className: "dsh-rp-muted"
    }, `${data.coverage.unattributedCalls} \u6B21\u539F\u751F\u8C03\u7528\u672A\u63D0\u4F9B\u4F1A\u8BDD\u8EAB\u4EFD\uFF0C\u5DF2\u4FDD\u7559\u8BCA\u65AD\u8BB0\u5F55\uFF0C\u5C1A\u672A\u5F52\u5165\u89D2\u8272\u626E\u6F14\u5408\u8BA1\u3002`) : null, mode === "usage" && total ? React.createElement(React.Fragment, null, React.createElement("div", {
      className: "dsh-rp-metrics"
    }, metric("\u8BF7\u6C42\u6B21\u6570", statNumber(total.calls), `\u6210\u529F ${total.successes} \xB7 \u5931\u8D25/\u53D6\u6D88/\u622A\u65AD ${total.failures}`), metric("\u8F93\u5165 \xB7 \u672A\u7F13\u5B58", tokenValue(total, "inputTokens"), "tokens", tokenNote(total, "inputTokens")), metric("\u8F93\u51FA", tokenValue(total, "outputTokens"), "tokens", tokenNote(total, "outputTokens")), metric("\u7F13\u5B58\u547D\u4E2D\u7387", rateValue(total.cacheHitRate), `\u547D\u4E2D ${tokenValue(total, "cacheReadTokens")} tokens`, rateNote(total)), metric("\u4F30\u7B97\u6210\u672C", costView(total).value === null ? "N/A" : `${data?.currency} ${statNumber(costView(total).value)}`, costView(total).caption === "\u5168\u90E8\u8BF7\u6C42\u5747\u6709\u5355\u4EF7\u548C\u7528\u91CF" ? "\u6309\u5F53\u524D\u5B9A\u4EF7\u914D\u7F6E\u4F30\u7B97" : costView(total).caption)), React.createElement("nav", {
      className: "dsh-rp-usage-tabs",
      role: "tablist"
    }, [["requests", "\u8BF7\u6C42\u65E5\u5FD7"], ["providers", "\u4F9B\u5E94\u5546\u7EDF\u8BA1"], ["models", "\u6A21\u578B\u7EDF\u8BA1"]].map(([id, label]) => React.createElement("button", {
      className: "dsh-rp-btn",
      key: id,
      role: "tab",
      "aria-selected": usageTab === id,
      onClick: () => {
        setUsageTab(id);
        setOffset(0);
      }
    }, label))), usageTab === "models" ? React.createElement(React.Fragment, null, React.createElement(UsageChart, {
      data
    }), React.createElement("div", {
      className: "dsh-rp-section-title"
    }, "\u6A21\u578B\u7EDF\u8BA1"), React.createElement("div", {
      className: "dsh-rp-table-wrap"
    }, React.createElement("table", {
      className: "dsh-rp-table"
    }, React.createElement("thead", null, React.createElement("tr", null, ["\u6A21\u578B / \u4F9B\u5E94\u5546", "\u8BF7\u6C42", "\u8F93\u5165", "\u8F93\u51FA", "\u7F13\u5B58\u547D\u4E2D\u7387", "\u4F30\u7B97\u6210\u672C", "\u6210\u529F\u7387", "\u5E73\u5747\u8017\u65F6", "\u751F\u6210\u901F\u5EA6"].map((h) => React.createElement("th", {
      key: h
    }, h)))), React.createElement("tbody", null, (data.models ?? []).map(modelUsageRow)))), React.createElement("p", {
      className: "dsh-rp-muted"
    }, "\u751F\u6210\u901F\u5EA6\u4E0D\u542B\u9996 token \u7B49\u5F85\uFF0C\u4EC5\u7EDF\u8BA1\u6570\u636E\u5B8C\u6574\u7684\u8BF7\u6C42\u3002"), React.createElement("details", {
      className: "dsh-rp-price-details"
    }, React.createElement("summary", null, "\u6A21\u578B\u5B9A\u4EF7"), React.createElement(PricePanel, {
      sessionId,
      models: data.models,
      onSaved: () => setRevision((v) => v + 1)
    }))) : null, usageTab === "providers" ? React.createElement(React.Fragment, null, React.createElement("div", {
      className: "dsh-rp-section-title"
    }, "\u4F9B\u5E94\u5546\u7EDF\u8BA1"), React.createElement("div", {
      className: "dsh-rp-table-wrap"
    }, React.createElement("table", {
      className: "dsh-rp-table"
    }, React.createElement("thead", null, React.createElement("tr", null, ["\u4F9B\u5E94\u5546", "\u8BF7\u6C42", "\u8F93\u5165", "\u8F93\u51FA", "\u7F13\u5B58\u547D\u4E2D\u7387", "\u4F30\u7B97\u6210\u672C", "\u6210\u529F\u7387", "\u5E73\u5747\u8017\u65F6", "\u751F\u6210\u901F\u5EA6"].map((h) => React.createElement("th", {
      key: h
    }, h)))), React.createElement("tbody", null, (data.providers ?? []).map(providerUsageRow)))), React.createElement("p", {
      className: "dsh-rp-muted"
    }, "\u751F\u6210\u901F\u5EA6\u4E0D\u542B\u9996 token \u7B49\u5F85\uFF0C\u4EC5\u7EDF\u8BA1\u6570\u636E\u5B8C\u6574\u7684\u8BF7\u6C42\u3002")) : null, usageTab === "requests" ? React.createElement(React.Fragment, null, React.createElement("div", {
      className: "dsh-rp-section-title"
    }, "\u8BF7\u6C42\u65E5\u5FD7"), requestBusy ? React.createElement("div", {
      className: "dsh-rp-muted",
      role: "status"
    }, "\u6B63\u5728\u8BFB\u53D6\u8BF7\u6C42\u8BB0\u5F55\u2026") : null, requests?.error ? React.createElement("div", {
      className: "dsh-rp-error",
      role: "alert"
    }, requests.error) : null, React.createElement("div", {
      className: "dsh-rp-table-wrap"
    }, React.createElement("table", {
      className: "dsh-rp-table"
    }, React.createElement("thead", null, React.createElement("tr", null, ["\u65F6\u95F4", "\u4F9B\u5E94\u5546 / \u6A21\u578B", "\u8F93\u5165 / \u7F13\u5B58", "\u8F93\u51FA", "\u6210\u672C", "\u8017\u65F6 / \u9996 token", "\u72B6\u6001", "\u6240\u5C5E\u4F1A\u8BDD"].map((h) => React.createElement("th", {
      key: h
    }, h)))), React.createElement("tbody", null, (requests?.rows ?? []).map(requestUsageRow)))), !requests?.rows?.length && !requestBusy ? React.createElement("div", {
      className: "dsh-rp-empty"
    }, "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8BF7\u6C42\u8BB0\u5F55") : null, React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("span", {
      className: "dsh-rp-muted"
    }, `\u5171 ${requests?.total ?? 0} \u6761`), React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: offset === 0 || requestBusy,
      onClick: () => setOffset(Math.max(0, offset - 50))
    }, "\u4E0A\u4E00\u9875"), React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: offset + 50 >= (requests?.total ?? 0) || requestBusy,
      onClick: () => setOffset(offset + 50)
    }, "\u4E0B\u4E00\u9875"))) : null) : null, mode === "logs" ? React.createElement(React.Fragment, null, React.createElement("div", {
      className: "dsh-rp-table-wrap"
    }, React.createElement("table", {
      className: "dsh-rp-table"
    }, React.createElement("thead", null, React.createElement("tr", null, ["\u8FD0\u884C\u65F6\u95F4", "\u4EFB\u52A1 / \u6A21\u578B", "\u72B6\u6001", "\u8017\u65F6 / \u9996 token", "\u8F93\u5165 / \u8F93\u51FA / \u7F13\u5B58", "\u8BE6\u60C5"].map((h) => React.createElement("th", {
      key: h
    }, h)))), React.createElement("tbody", null, (data?.rows ?? []).map((r) => React.createElement("tr", {
      key: r.id
    }, React.createElement("td", null, statTime(r.startedAt)), React.createElement("td", null, React.createElement("strong", null, r.label ?? telemetryKind[r.kind] ?? r.kind), React.createElement("div", {
      className: "dsh-rp-muted"
    }, `${r.provider ?? "\u2014"} / ${r.model ?? "\u2014"}`)), React.createElement("td", null, React.createElement("span", {
      className: `dsh-rp-status-badge dsh-rp-state-${r.status}`
    }, telemetryStatus[r.status] ?? r.status)), React.createElement("td", null, `${r.durationMs == null ? "N/A" : (r.durationMs / 1e3).toFixed(2) + "s"} / ${r.firstTokenMs == null ? "N/A" : (r.firstTokenMs / 1e3).toFixed(2) + "s"}`), React.createElement("td", null, r.usage ? `${statNumber(r.usage.inputTokens)} / ${statNumber(r.usage.outputTokens)} / ${statNumber(r.usage.cacheReadTokens)}` : "N/A", r.usageNote ? React.createElement("small", {
      className: "dsh-rp-muted"
    }, r.usageNote) : null), React.createElement("td", null, r.fallback ? formatFallbackText(r.fallback) : r.error ?? (r.progress ? `${r.progress.done ?? 0}/${r.progress.total ?? 0}` : "\u2014"))))))), !data?.rows?.length && !busy ? React.createElement("div", {
      className: "dsh-rp-empty"
    }, "\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8FD0\u884C\u8BB0\u5F55") : null, React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("span", {
      className: "dsh-rp-muted"
    }, `\u5171 ${data?.total ?? 0} \u6761`), React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: offset === 0 || busy,
      onClick: () => setOffset(Math.max(0, offset - 50))
    }, "\u4E0A\u4E00\u9875"), React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: offset + 50 >= (data?.total ?? 0) || busy,
      onClick: () => setOffset(offset + 50)
    }, "\u4E0B\u4E00\u9875"))) : null, React.createElement("p", {
      className: "dsh-rp-muted"
    }, "\u5386\u53F2\u6570\u636E\u6765\u81EA\u4FDD\u5B58\u7684\u8C03\u7528\u4E8B\u4EF6\uFF1B\u672A\u7559\u5B58\u7684\u5386\u53F2\u7528\u91CF\u65E0\u6CD5\u8865\u7B97\u3002\u65B0\u8C03\u7528\u901A\u8FC7 DSH \u539F\u751F\u63A5\u53E3\u5B9E\u65F6\u8BB0\u5F55\u3002"), total?.unknownUsage ? React.createElement("p", {
      className: "dsh-rp-muted"
    }, "\u90E8\u5206\u7528\u91CF\u53EF\u80FD\u4E0D\u51C6\u786E\u6216\u7F3A\u5C11\u6570\u636E") : null);
  }
  return {
    TelemetryPanel,
    PricePanel,
    UsageChart
  };
}

// user-info.js
function createUserInfoSettings({ React, toast }) {
  function UserInfoSettings() {
    const [name, setName] = React.useState(null);
    const [gender, setGender] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);
    React.useEffect(() => {
      let alive = true;
      fetch("/api/roleplay/userinfo").then((response) => response.json()).then((data) => {
        if (!alive)
          return;
        if (name === null)
          setName(data?.userinfo?.name ?? "");
        if (gender === null)
          setGender(data?.userinfo?.gender ?? "");
        setLoaded(true);
      }).catch(() => {
        if (alive)
          setLoaded(true);
      });
      return () => {
        alive = false;
      };
    }, []);
    const save = async () => {
      setSaving(true);
      try {
        const res = await fetch("/api/roleplay/userinfo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, gender })
        });
        const data = await res.json();
        if (!data.ok)
          throw new Error(String(data.error ?? "\u4FDD\u5B58\u5931\u8D25"));
        toast("\u7528\u6237\u4FE1\u606F\u5DF2\u4FDD\u5B58\uFF08{{user}} \u5C06\u4F7F\u7528\u6B64\u59D3\u540D\uFF09");
      } catch (error) {
        toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(error && typeof error === "object" && "message" in error ? error.message ?? error : error));
      } finally {
        setSaving(false);
      }
    };
    const field = (label, value, onChange, placeholder) => React.createElement("label", { className: "dsh-rp-row", style: { marginBottom: "8px" } }, React.createElement("span", { className: "dsh-rp-muted", style: { width: "72px" } }, label), React.createElement("input", { className: "dsh-rp-input", value: value ?? "", placeholder, disabled: saving, onChange: (event) => onChange(event.target.value) }));
    if (!loaded)
      return React.createElement("div", { className: "dsh-rp-muted" }, "\u52A0\u8F7D\u4E2D\u2026");
    return React.createElement("div", { style: { maxWidth: 420 } }, React.createElement("h4", null, "\u89D2\u8272\u626E\u6F14 \xB7 \u7528\u6237\u4FE1\u606F"), field("\u540D\u5B57", name, setName, "\u5267\u60C5\u4E2D\u5982\u4F55\u79F0\u547C\u4F60\uFF08{{user}}\uFF09"), field("\u6027\u522B", gender, setGender, "\u5982\uFF1A\u7537 / \u5973 / \u4FDD\u5BC6"), React.createElement("div", { className: "dsh-rp-row" }, React.createElement("button", { type: "button", className: "dsh-rp-btn", onClick: save, disabled: saving }, saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58"), React.createElement("span", { className: "dsh-rp-muted" }, "\u4F5C\u4E3A {{user}} / {{user_gender}} \u63D0\u793A\u8BCD\u53D8\u91CF\u63D0\u4F9B\u7ED9\u6A21\u578B")));
  }
  return UserInfoSettings;
}

// panel-state.js
async function fetchRoleplayText(url, timeoutMs = 15e3) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("\u9152\u9986\u72B6\u6001\u8BF7\u6C42\u8D85\u65F6\uFF0C\u6B63\u5728\u91CD\u8BD5"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([(async () => {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      return { response, raw: await response.text() };
    })(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
function startActivityPolling({ eligible, read, receive, schedule = (fn) => setInterval(fn, 3e3), cancel = clearInterval }) {
  let alive = true, busy = false;
  const load = async () => {
    if (!alive || busy || !eligible())
      return;
    busy = true;
    try {
      const data = await read();
      if (alive)
        receive(data);
    } catch {
    } finally {
      busy = false;
    }
  };
  void load();
  const timer = schedule(load);
  return () => {
    alive = false;
    cancel(timer);
  };
}
var createRefreshScheduler = (run) => {
  let running = false;
  let queued = false;
  let closed = false;
  const request = () => {
    if (closed)
      return;
    if (running) {
      queued = true;
      return;
    }
    running = true;
    Promise.resolve().then(run).finally(() => {
      running = false;
      if (queued && !closed) {
        queued = false;
        request();
      } else
        queued = false;
    });
  };
  return { request, close: () => {
    closed = true;
    queued = false;
  } };
};
function updatePanelDraft(store, sessionId, tab, patch) {
  const key = `${sessionId ?? "none"}:${tab}`;
  const next = { ...store.get(key) ?? {}, ...patch ?? {} };
  store.set(key, next);
  return next;
}
function buildRulesSaveBody(field, value, rules = {}) {
  const apiField = field === "styleKw" ? "style" : field;
  return { kind: "rules", [apiField]: value ?? "" };
}
function buildCustomRulesSaveBody(narrative, reply) {
  return { kind: "rules", narrative: narrative ?? "", reply: reply ?? "" };
}
function markPanelDraftFields(store, sessionId, tab, patch) {
  const key = `${sessionId ?? "none"}:${tab}`;
  const prior = store.get(key) ?? {};
  const fieldSeqs = { ...prior.fieldSeqs ?? {} };
  const dirtyFields = new Set(prior.dirtyFields ?? []);
  for (const field of Object.keys(patch ?? {})) {
    fieldSeqs[field] = Number(fieldSeqs[field] ?? 0) + 1;
    dirtyFields.add(field);
  }
  const next = { ...prior, ...patch ?? {}, dirty: true, dirtyFields: [...dirtyFields], fieldSeqs };
  store.set(key, next);
  return next;
}
function settlePanelDraftFields(store, sessionId, tab, fields, versions, expectedSeqs) {
  const key = `${sessionId ?? "none"}:${tab}`;
  const prior = store.get(key);
  if (!prior)
    return null;
  const expected = typeof expectedSeqs === "number" ? Object.fromEntries(fields.map((field) => [field, expectedSeqs])) : expectedSeqs ?? {};
  const next = { ...prior, baseVersions: { ...prior.baseVersions ?? {}, ...versions ?? {} } };
  const dirtyFields = new Set(prior.dirtyFields ?? []);
  for (const field of fields) {
    if (expected[field] !== void 0 && prior.fieldSeqs?.[field] !== expected[field])
      continue;
    delete next[field];
    dirtyFields.delete(field);
  }
  next.dirtyFields = [...dirtyFields];
  next.dirty = next.dirtyFields.length > 0;
  if (!next.dirty)
    store.delete(key);
  else
    store.set(key, next);
  return next.dirty ? next : null;
}

// management-panels.js
var errorMessage2 = (error) => error && typeof error === "object" && "message" in error ? error.message : error;
function createManagementPanels({ React, sessionDrafts, jsonFetch, toast, confirmWithDialog: confirmWithDialog2, btn }) {
  function CharacterClusterPanel({ sessionId }) {
    const [globalRoute, setGlobalRoute] = React.useState(null);
    const [dataValue, setData] = React.useState(null), [modelsValue, setModels] = React.useState(null), [draftValue, setDraft] = React.useState(null), [error, setError] = React.useState(""), [saving, setSaving] = React.useState(false), [revision, setRevision] = React.useState(0);
    const data = dataValue, models = modelsValue, draft = draftValue;
    React.useEffect(() => {
      let live = true;
      setData(null);
      setDraft(null);
      setError("");
      Promise.all([
        jsonFetch("/api/roleplay/character-cluster?sessionId=" + encodeURIComponent(sessionId)),
        jsonFetch("/api/roleplay/models?sessionId=" + encodeURIComponent(sessionId))
      ]).then(([d, m]) => {
        if (!live)
          return;
        setData(d);
        setModels(m);
        setDraft(d.session);
        setGlobalRoute(d.global.defaultRoute ?? null);
      }).catch((e) => {
        if (live)
          setError(String(errorMessage2(e)));
      });
      return () => {
        live = false;
      };
    }, [sessionId, revision]);
    const save = async (scope) => {
      if (saving)
        return;
      setSaving(true);
      try {
        const d = await jsonFetch("/api/roleplay/character-cluster", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            scope,
            settings: scope === "global" ? {
              defaultRoute: globalRoute
            } : draft,
            expectedRevision: scope === "global" ? data.global.revision : data.settings.revision
          })
        });
        setData(d);
        if (scope === "session")
          setDraft(d.session);
        else
          setGlobalRoute(d.global.defaultRoute ?? null);
        toast(scope === "global" ? "\u9ED8\u8BA4\u89D2\u8272\u6A21\u578B\u5DF2\u4FDD\u5B58\uFF0C\u5BF9\u6240\u6709\u5BF9\u8BDD\u751F\u6548" : "\u89D2\u8272\u96C6\u7FA4\u5F00\u5173\u4E0E\u4EBA\u7269\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u4EC5\u5BF9\u5F53\u524D\u5BF9\u8BDD\u751F\u6548");
      } catch (e) {
        toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(errorMessage2(e)));
      } finally {
        setSaving(false);
      }
    };
    const h = React.createElement, catalog = models?.catalog ?? [];
    const selector = (label, route, onChange, isDefault = false) => {
      const effective = route?.main ? {
        ...models.main,
        ...route
      } : route ?? (isDefault ? models.main : data.settings.defaultRoute?.main ? {
        ...models.main,
        ...data.settings.defaultRoute
      } : data.settings.defaultRoute ?? models.main);
      const model = catalog.find((m) => m.provider === effective?.provider && m.model === effective?.model);
      const value = route?.main ? "main" : route ? `${route.provider}\0${route.model}` : "";
      const options = buildReasoningEffortOptions(model, route?.reasoningEffort);
      return h("div", {
        className: "dsh-rp-item",
        key: label
      }, h("div", {
        className: "dsh-rp-item-head"
      }, label), h("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))",
          gap: "12px",
          marginTop: "10px"
        }
      }, h("label", null, "\u6A21\u578B", h("select", {
        className: "dsh-rp-input",
        style: {
          width: "100%",
          minWidth: 0
        },
        "aria-label": label + "\u6A21\u578B",
        value,
        onChange: (e) => {
          const v = e.target.value;
          if (!v)
            onChange(null);
          else if (v === "main")
            onChange({
              main: true
            });
          else {
            const [provider, model2] = v.split("\0");
            onChange({
              provider,
              model: model2
            });
          }
        }
      }, h("option", {
        value: ""
      }, isDefault ? "\u8DDF\u968F\u4E3B\u4EE3\u7406\u6A21\u578B" : "\u4F7F\u7528\u96C6\u7FA4\u9ED8\u8BA4\u6A21\u578B"), h("option", {
        value: "main"
      }, "\u4E0E\u4E3B\u4EE3\u7406\u76F8\u540C\uFF08\u72EC\u7ACB\u89D2\u8272\u4EE3\u7406\uFF09"), catalog.map((m) => h("option", {
        key: m.provider + ":" + m.model,
        value: `${m.provider}\0${m.model}`
      }, `${m.label ?? m.model} \xB7 ${m.provider}`)))), h("label", null, "\u601D\u8003\u5F3A\u5EA6", h("select", {
        className: "dsh-rp-input",
        style: {
          width: "100%",
          minWidth: 0
        },
        "aria-label": label + "\u601D\u8003\u5F3A\u5EA6",
        value: route?.reasoningEffort ?? "",
        disabled: !model,
        onChange: (e) => onChange({
          ...route ?? effective,
          reasoningEffort: e.target.value || void 0
        })
      }, options.map((o) => h("option", {
        key: o.id || "default",
        value: o.id
      }, o.name))))));
    };
    return h("div", {
      className: "dsh-rp-panel",
      "data-roleplay-character-cluster": true
    }, h("div", {
      className: "dsh-rp-row"
    }, h("h4", {
      style: {
        flex: 1,
        margin: 0
      }
    }, "\u89D2\u8272 agent \u96C6\u7FA4"), btn("\u5237\u65B0\u4EBA\u7269\u4E0E\u8BBE\u7F6E", () => setRevision((r) => r + 1), {
      disabled: saving
    })), h("p", {
      className: "dsh-rp-muted"
    }, "\u8BA9\u4E3B\u8981\u4EBA\u7269\u5148\u72EC\u7ACB\u63A8\u6F14\u81EA\u5DF1\u7684\u884C\u52A8\u4E0E\u53F0\u8BCD\uFF0C\u518D\u7531\u4E3B\u7B14\u534F\u8C03\u6210\u6545\u4E8B\u3002\u5F00\u5173\u4E0E\u4EBA\u7269\u5355\u72EC\u8BBE\u7F6E\u4EC5\u5F53\u524D\u5BF9\u8BDD\u751F\u6548\uFF1B\u9ED8\u8BA4\u6A21\u578B\u5BF9\u6240\u6709\u5BF9\u8BDD\u751F\u6548\uFF0C\u5267\u60C5\u8D44\u6599\u59CB\u7EC8\u72EC\u7ACB\u3002"), error ? h("p", {
      className: "dsh-rp-error",
      role: "alert"
    }, error) : !draft ? h("p", {
      role: "status"
    }, "\u6B63\u5728\u52A0\u8F7D\u89D2\u8272\u96C6\u7FA4\u2026") : h("fieldset", {
      disabled: saving,
      style: {
        border: 0,
        padding: 0,
        margin: 0,
        minWidth: 0
      }
    }, h("label", {
      className: "dsh-rp-row"
    }, h("input", {
      type: "checkbox",
      checked: draft.enabled,
      onChange: (e) => setDraft({
        ...draft,
        enabled: e.target.checked
      })
    }), "\u5F00\u542F\u89D2\u8272 agent \u96C6\u7FA4\u6A21\u5F0F"), h("p", {
      className: "dsh-rp-muted"
    }, "\u8BFB\u5361\u56DE\u5408\u4E0D\u8FD0\u884C\u3002\u6BCF\u4F4D\u51FA\u573A\u4E3B\u8981\u4EBA\u7269\u5404\u81EA\u8FD0\u884C\u4E00\u6B21\uFF0C\u53EF\u6309\u9700\u67E5\u9605\u5386\u53F2\uFF1B\u5931\u8D25\u6216\u8D85\u65F6\u4F1A\u4F7F\u7528\u4E3B\u4EE3\u7406\u6A21\u578B\u518D\u8BD5\u4E00\u6B21\uFF0C\u4ECD\u5931\u8D25\u7531\u4E3B\u7B14\u81EA\u7531\u53D1\u6325\u3002\u5F00\u542F\u4F1A\u589E\u52A0\u8BF7\u6C42\u7528\u91CF\u548C\u6B63\u6587\u7B49\u5F85\u65F6\u95F4\u3002"), h("section", {
      className: "dsh-rp-cluster-default",
      "aria-label": "\u89D2\u8272\u96C6\u7FA4\u9ED8\u8BA4\u6A21\u578B\uFF08\u5168\u5C40\uFF09"
    }, h("span", {
      className: "dsh-rp-cluster-scope"
    }, "\u5168\u5C40\u9ED8\u8BA4 \xB7 \u6240\u6709\u5BF9\u8BDD"), selector("\u89D2\u8272\u96C6\u7FA4\u9ED8\u8BA4\u6A21\u578B\uFF08\u5168\u5C40\uFF09", globalRoute, setGlobalRoute, true), h("p", {
      className: "dsh-rp-muted"
    }, "\u6240\u6709\u672A\u5355\u72EC\u6307\u5B9A\u6A21\u578B\u7684\u4EBA\u7269\u90FD\u4F7F\u7528\u6B64\u9ED8\u8BA4\u503C\uFF1B\u4FDD\u5B58\u4E0D\u4F1A\u5F00\u542F\u5176\u4ED6\u5BF9\u8BDD\u7684\u96C6\u7FA4\u3002"), Number(data.global.revision) === 0 && data.session.defaultRoute ? h("p", {
      className: "dsh-rp-muted"
    }, "\u5F53\u524D\u5BF9\u8BDD\u6682\u65F6\u6CBF\u7528\u65E7\u7248\u9ED8\u8BA4\u6A21\u578B\uFF1B\u4FDD\u5B58\u4E00\u6B21\u5168\u5C40\u9009\u62E9\u540E\uFF0C\u6240\u6709\u5BF9\u8BDD\u7EDF\u4E00\u7EE7\u627F\u5168\u5C40\u9ED8\u8BA4\u3002") : null, h("div", {
      className: "dsh-rp-row"
    }, btn(saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u5168\u5C40\u9ED8\u8BA4\u6A21\u578B", () => save("global"), {
      disabled: saving
    }))), h("section", {
      className: "dsh-rp-cluster-characters",
      "aria-label": "\u4EBA\u7269\u5355\u72EC\u6A21\u578B"
    }, h("h4", null, "\u4EBA\u7269\u5355\u72EC\u6A21\u578B"), h("p", {
      className: "dsh-rp-muted"
    }, "\u4EC5\u5F53\u524D\u5BF9\u8BDD\u751F\u6548\u3002\u9009\u62E9\u201C\u4F7F\u7528\u96C6\u7FA4\u9ED8\u8BA4\u6A21\u578B\u201D\u5373\u53EF\u8DDF\u968F\u4E0A\u65B9\u5DF2\u4FDD\u5B58\u7684\u5168\u5C40\u9ED8\u8BA4\u8BBE\u7F6E\u3002"), data.characters.map((character) => selector(character.name, draft.characters?.[character.id], (route) => setDraft({
      ...draft,
      characters: {
        ...draft.characters,
        [character.id]: route
      }
    }))), !data.characters.length ? h("p", {
      className: "dsh-rp-muted"
    }, "\u5F53\u524D\u8FD8\u6CA1\u6709\u72EC\u7ACB\u4EBA\u7269\u8BBE\u5B9A\u3002\u8BFB\u5361\u540E\u4F1A\u5728\u8FD9\u91CC\u663E\u793A\uFF1B\u6545\u4E8B\u4E2D\u65B0\u767B\u8BB0\u7684\u91CD\u8981\u4EBA\u7269\u4E5F\u4F1A\u52A0\u5165\u3002") : null), h("div", {
      className: "dsh-rp-row"
    }, btn(saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u5F53\u524D\u5BF9\u8BDD\u8BBE\u7F6E", () => save("session"), {
      disabled: saving
    }))));
  }
  function ModelPanel({ sessionId }) {
    const [data, setData] = React.useState(null), [scope, setScope] = React.useState("session"), [saving, setSaving] = React.useState(false), [allMain, setAllMain] = React.useState(false), [routes, setRoutes] = React.useState({});
    React.useEffect(() => {
      let live = true;
      jsonFetch(`/api/roleplay/models?sessionId=${encodeURIComponent(sessionId)}`).then((value) => live && setData(value)).catch((e) => live && setData({
        error: String(errorMessage2(e))
      }));
      return () => {
        live = false;
      };
    }, [sessionId]);
    React.useEffect(() => {
      if (!data)
        return;
      const draft = sessionDrafts.get(`${sessionId}:models-${scope}`);
      const source = draft?.dirty ? draft.settings : scope === "global" ? data.global : data.session && !data.session.inherit ? data.session : data.effective;
      setAllMain(source?.allMain === true);
      setRoutes({
        ...source?.routes ?? {}
      });
    }, [data, scope]);
    const rememberModel = (nextAllMain, nextRoutes) => {
      const prior = sessionDrafts.get(`${sessionId}:models-${scope}`);
      updatePanelDraft(sessionDrafts, sessionId, `models-${scope}`, {
        dirty: true,
        settings: buildModelSettings(nextAllMain, nextRoutes),
        baseRevision: prior?.dirty ? prior.baseRevision : data?.[scope]?.revision ?? 0
      });
      setAllMain(nextAllMain);
      setRoutes(nextRoutes);
    };
    const save = async () => {
      if (saving)
        return;
      setSaving(true);
      try {
        const settings = buildModelSettings(allMain, routes), draft = sessionDrafts.get(`${sessionId}:models-${scope}`);
        const updated = await jsonFetch("/api/roleplay/models", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            scope,
            settings,
            expectedRevision: draft?.baseRevision ?? data?.[scope]?.revision ?? 0
          })
        });
        if (sessionDrafts.get(`${sessionId}:models-${scope}`) === draft)
          sessionDrafts.delete(`${sessionId}:models-${scope}`);
        setData(updated);
        toast("\u6A21\u578B\u8BBE\u7F6E\u5DF2\u4FDD\u5B58");
      } catch (e) {
        toast("\u6A21\u578B\u4FDD\u5B58\u5931\u8D25\uFF0C\u8349\u7A3F\u5DF2\u4FDD\u7559\uFF1A" + String(errorMessage2(e)));
      } finally {
        setSaving(false);
      }
    };
    const clearSession = async () => {
      if (scope !== "session" || saving)
        return;
      setSaving(true);
      const prior = sessionDrafts.get(`${sessionId}:models-session`);
      try {
        const updated = await jsonFetch("/api/roleplay/models", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            scope: "session",
            settings: null,
            expectedRevision: data?.session?.revision ?? 0
          })
        });
        if (sessionDrafts.get(`${sessionId}:models-session`) === prior)
          sessionDrafts.delete(`${sessionId}:models-session`);
        setData(updated);
        toast("\u5DF2\u6062\u590D\u5168\u5C40\u6A21\u578B\u8BBE\u7F6E");
      } catch (e) {
        toast("\u6062\u590D\u5168\u5C40\u8BBE\u7F6E\u5931\u8D25\uFF1A" + String(errorMessage2(e)));
      } finally {
        setSaving(false);
      }
    };
    if (!data)
      return React.createElement("div", {
        className: "dsh-rp-muted"
      }, "\u52A0\u8F7D\u6A21\u578B\u2026");
    if (data.error)
      return React.createElement("div", {
        className: "dsh-rp-error"
      }, data.error);
    const catalog = Array.isArray(data.catalog) ? data.catalog : [];
    const routeValue = (route) => route ? `${route.provider}\0${route.model}` : "";
    const parseRoute = (value) => {
      if (!value)
        return null;
      const [provider, ...modelParts] = value.split("\0");
      return {
        provider,
        model: modelParts.join("\0")
      };
    };
    const mainRoute = data.main ?? data.effective?.main ?? {};
    return React.createElement("fieldset", {
      className: "dsh-rp-panel",
      disabled: saving,
      style: {
        border: 0,
        margin: 0,
        minWidth: 0
      }
    }, React.createElement("h4", null, "\u6A21\u578B\u8DEF\u7531"), React.createElement("label", {
      className: "dsh-rp-row"
    }, "\u4FDD\u5B58\u8303\u56F4", React.createElement("select", {
      className: "dsh-rp-input",
      value: scope,
      onChange: (e) => setScope(e.target.value)
    }, React.createElement("option", {
      value: "session"
    }, "\u5F53\u524D\u4F1A\u8BDD"), React.createElement("option", {
      value: "global"
    }, "\u5168\u5C40"))), React.createElement("label", {
      className: "dsh-rp-row"
    }, React.createElement("input", {
      type: "checkbox",
      checked: allMain,
      onChange: (e) => rememberModel(e.target.checked, routes)
    }), "\u5168\u90E8\u4F7F\u7528\u4E3B\u6A21\u578B\uFF08\u4FDD\u7559\u7528\u9014\u914D\u7F6E\uFF09"), React.createElement("div", {
      className: "dsh-rp-muted"
    }, `\u5F53\u524D\u4E3B\u6A21\u578B\uFF1A${data.main?.model ?? data.effective?.main?.model ?? "\u672A\u8BBE\u7F6E"}`), MODEL_PURPOSE_IDS.map((id) => {
      const purpose = (data.purposes ?? []).find((p) => p.id === id) ?? {
        id,
        label: id
      };
      const current = routes[id] ?? null;
      const model = catalog.find((route) => route.provider === current?.provider && route.model === current?.model);
      const effortOptions = buildReasoningEffortOptions(model, current?.reasoningEffort);
      const followsMain = allMain || !current || current.provider === mainRoute.provider && current.model === mainRoute.model;
      const updateEffort = (effort) => rememberModel(allMain, {
        ...routes,
        [id]: {
          ...current,
          reasoningEffort: effort || void 0
        }
      });
      return React.createElement("div", {
        className: "dsh-rp-item",
        key: id
      }, React.createElement("div", {
        className: "dsh-rp-item-head"
      }, purpose.label ?? id, React.createElement("span", {
        className: "dsh-rp-muted"
      }, current?.model ?? "\u8DDF\u968F\u4E3B\u6A21\u578B")), React.createElement("select", {
        className: "dsh-rp-input",
        value: routeValue(current),
        onChange: (e) => rememberModel(allMain, {
          ...routes,
          [id]: parseRoute(e.target.value)
        })
      }, React.createElement("option", {
        value: ""
      }, "\u8DDF\u968F\u4E3B\u6A21\u578B"), catalog.map((route) => React.createElement("option", {
        key: `${route.provider}:${route.model}`,
        value: `${route.provider}\0${route.model}`
      }, `${route.label ?? route.model} \xB7 ${route.provider}`))), React.createElement("label", {
        className: "dsh-rp-row"
      }, "\u601D\u8003\u7B49\u7EA7", React.createElement("select", {
        className: "dsh-rp-input",
        value: current?.reasoningEffort ?? "",
        disabled: followsMain || !model,
        "aria-label": `${purpose.label ?? id}\u601D\u8003\u7B49\u7EA7`,
        onChange: (e) => updateEffort(e.target.value)
      }, effortOptions.map((option) => React.createElement("option", {
        key: option.id || "default",
        value: option.id
      }, option.name)))), followsMain ? React.createElement("span", {
        className: "dsh-rp-muted"
      }, "\u8DDF\u968F\u4E3B\u6A21\u578B\u601D\u8003\u7B49\u7EA7\uFF08\u4E13\u7528\u914D\u7F6E\u4ECD\u4FDD\u7559\uFF09") : !model && current?.reasoningEffort ? React.createElement("span", {
        className: "dsh-rp-error"
      }, `\u5F53\u524D\u601D\u8003\u7B49\u7EA7\u201C${current.reasoningEffort}\u201D\u7684\u6A21\u578B\u4E0D\u5728\u76EE\u5F55\u4E2D\uFF0C\u5DF2\u4FDD\u7559\u539F\u8BBE\u7F6E\uFF1B\u8BF7\u9009\u62E9\u6A21\u578B\u540E\u518D\u8C03\u6574\u3002`) : current?.reasoningEffort && effortOptions.some((option) => option.unknown) ? React.createElement("span", {
        className: "dsh-rp-error"
      }, "\u5F53\u524D\u601D\u8003\u7B49\u7EA7\u4E0D\u5728\u8BE5\u6A21\u578B\u76EE\u5F55\u4E2D\uFF0C\u5DF2\u4FDD\u7559\u539F\u8BBE\u7F6E\uFF1B\u53EF\u9009\u56DE\u6A21\u578B\u9ED8\u8BA4\u3002") : null);
    }), React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: saving,
      onClick: () => save()
    }, saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u6A21\u578B\u8DEF\u7531"), scope === "session" ? React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: saving,
      onClick: clearSession
    }, "\u6E05\u9664\u4F1A\u8BDD\u8986\u76D6") : null));
  }
  const resourceTypeLabels = {
    "image/png": "\u5361\u7247 PNG",
    "application/json": "\u5361\u7247 JSON",
    "text/markdown": "Markdown",
    "text/plain": "\u6587\u672C",
    png: "\u5361\u7247 PNG",
    json: "\u5361\u7247 JSON",
    md: "Markdown",
    markdown: "Markdown",
    image: "\u56FE\u7247",
    text: "\u6587\u672C"
  };
  const resourceTypeLabel = (type) => resourceTypeLabels[String(type ?? "").toLowerCase()] ?? String(type ?? "\u5176\u4ED6");
  function ResourcesPanel({ sessionId }) {
    const [data, setData] = React.useState(null), [query, setQuery] = React.useState(""), [type, setType] = React.useState("all"), [preview, setPreview] = React.useState(null), [order, setOrder] = React.useState("time-desc"), [loading, setLoading] = React.useState(false);
    const listSequence = React.useRef(0), previewSequence = React.useRef(0);
    const load = React.useCallback(async () => {
      const ticket = ++listSequence.current;
      setLoading(true);
      try {
        const { response, raw } = await fetchRoleplayText(`/api/roleplay/resources?sessionId=${encodeURIComponent(sessionId)}`);
        const value = JSON.parse(raw);
        if (!response.ok || value.ok === false)
          throw new Error(value.error ?? "\u8D44\u6E90\u5237\u65B0\u5931\u8D25");
        if (ticket === listSequence.current)
          setData(value);
      } catch (e) {
        if (ticket === listSequence.current)
          setData((previous) => ({
            ...previous,
            error: String(errorMessage2(e))
          }));
      } finally {
        if (ticket === listSequence.current)
          setLoading(false);
      }
    }, [sessionId]);
    React.useEffect(() => {
      setData(null);
      setPreview(null);
      void load();
      return () => {
        listSequence.current++;
        previewSequence.current++;
      };
    }, [load]);
    const allResources = data?.resources ?? [];
    const types = [...new Set(allResources.map((r) => String(r.type ?? "").toLowerCase()).filter(Boolean))];
    const resources = sortLibraryResources(allResources.filter((r) => (type === "all" || String(r.type ?? "").toLowerCase() === type) && (!query || `${r.name} ${r.type} ${r.path}`.toLowerCase().includes(query.toLowerCase()))), order);
    const view = async (resource) => {
      const ticket = ++previewSequence.current;
      setPreview(null);
      try {
        const value = await jsonFetch(`/api/roleplay/resource?sessionId=${encodeURIComponent(sessionId)}&resourceId=${encodeURIComponent(resource.id)}`);
        if (ticket === previewSequence.current)
          setPreview(value);
      } catch (e) {
        if (ticket === previewSequence.current)
          toast("\u8D44\u6E90\u8BFB\u53D6\u5931\u8D25\uFF1A" + String(errorMessage2(e)));
      }
    };
    const importResource = async (resource) => {
      if (!isCardReadableResource(resource)) {
        toast("\u8BE5\u8D44\u6E90\u4E0D\u662F\u53EF\u8BFB\u89D2\u8272\u5361\uFF0C\u4E0D\u80FD\u8F7D\u5165\u5F53\u524D\u4EBA\u8BBE");
        return;
      }
      if (!await confirmWithDialog2(document, "\u8F7D\u5165\u4F1A\u66FF\u6362\u5F53\u524D\u4EBA\u8BBE\uFF0C\u786E\u5B9A\u7EE7\u7EED\uFF1F", {
        title: "\u8F7D\u5165\u5F53\u524D\u4EBA\u8BBE",
        confirmLabel: "\u786E\u8BA4\u8F7D\u5165"
      }))
        return;
      try {
        await jsonFetch("/api/roleplay/jobs", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            kind: "card-import",
            resourceId: resource.id
          })
        });
        toast("\u5DF2\u521B\u5EFA\u89D2\u8272\u5361\u5BFC\u5165\u4EFB\u52A1");
      } catch (e) {
        toast("\u5BFC\u5165\u4EFB\u52A1\u5931\u8D25\uFF1A" + String(errorMessage2(e)));
      }
    };
    const pendingItems = Array.isArray(data?.pending) ? data.pending : [];
    return React.createElement("div", {
      className: "dsh-rp-panel"
    }, React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("h4", null, "\u8D44\u6E90\u5E93"), React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: loading,
      onClick: load
    }, loading ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0\u8D44\u6E90\u5E93")), React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("input", {
      className: "dsh-rp-input",
      placeholder: "\u641C\u7D22\u8D44\u6E90",
      value: query,
      onChange: (e) => setQuery(e.target.value)
    }), React.createElement("select", {
      className: "dsh-rp-input",
      "aria-label": "\u8D44\u6E90\u7C7B\u578B",
      value: type,
      onChange: (e) => setType(e.target.value)
    }, React.createElement("option", {
      value: "all"
    }, "\u5168\u90E8\u7C7B\u578B"), types.map((value) => React.createElement("option", {
      key: value,
      value
    }, resourceTypeLabel(value)))), React.createElement("select", {
      className: "dsh-rp-input",
      "aria-label": "\u8D44\u6E90\u6392\u5E8F",
      value: order,
      onChange: (e) => setOrder(e.target.value)
    }, [
      ["time-desc", "\u4FEE\u6539\u65F6\u95F4\uFF1A\u6700\u65B0\u5728\u524D"],
      ["time-asc", "\u4FEE\u6539\u65F6\u95F4\uFF1A\u6700\u65E9\u5728\u524D"],
      ["name-asc", "\u540D\u79F0\uFF1A\u5347\u5E8F"],
      ["name-desc", "\u540D\u79F0\uFF1A\u964D\u5E8F"]
    ].map(([value, label]) => React.createElement("option", {
      key: value,
      value
    }, label)))), loading && !data ? React.createElement("p", {
      className: "dsh-rp-muted",
      role: "status"
    }, "\u6B63\u5728\u52A0\u8F7D\u8D44\u6E90\u2026") : null, pendingItems.length ? React.createElement("div", {
      className: "dsh-rp-item"
    }, React.createElement("div", {
      className: "dsh-rp-item-head"
    }, "\u5F85\u5904\u7406\u8D44\u6E90"), pendingItems.map((item, index) => React.createElement("div", {
      className: "dsh-rp-row",
      key: index
    }, React.createElement("span", null, item.name ?? "\u672A\u547D\u540D\u8D44\u6E90"), React.createElement("span", {
      className: "dsh-rp-error"
    }, item.reason))), React.createElement("button", {
      className: "dsh-rp-btn",
      onClick: load,
      disabled: loading
    }, "\u91CD\u65B0\u68C0\u67E5")) : null, preview ? React.createElement("pre", {
      className: "dsh-rp-item"
    }, String(preview.text ?? preview.resource?.text ?? "")) : null, data?.error ? React.createElement("div", {
      className: "dsh-rp-error",
      role: "alert"
    }, data.error) : null, !loading && data && !data.error && !resources.length ? React.createElement("p", {
      className: "dsh-rp-muted"
    }, "\u6CA1\u6709\u627E\u5230\u8D44\u6E90\uFF0C\u53EF\u8C03\u6574\u7B5B\u9009\u6216\u70B9\u51FB\u5237\u65B0\u3002") : null, resources.map((resource) => {
      const timestamp = resource.modifiedAt ?? resource.updatedAt ?? resource.createdAt;
      return React.createElement("div", {
        className: "dsh-rp-item",
        key: resource.id
      }, React.createElement("div", {
        className: "dsh-rp-item-head"
      }, resource.name, React.createElement("span", {
        className: "dsh-rp-muted"
      }, `${resourceTypeLabel(resource.type)} \xB7 ${resource.bytes} bytes`)), React.createElement("div", {
        className: "dsh-rp-muted"
      }, "\u4FEE\u6539\u65F6\u95F4\uFF1A", timestamp && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toLocaleString() : "\u672A\u77E5"), React.createElement("div", {
        className: "dsh-rp-row"
      }, React.createElement("button", {
        className: "dsh-rp-btn",
        onClick: () => view(resource)
      }, "\u67E5\u770B"), React.createElement("button", {
        className: "dsh-rp-btn",
        onClick: () => navigator.clipboard?.writeText(resource.path).then(() => toast("\u8D44\u6E90\u8DEF\u5F84\u5DF2\u590D\u5236")).catch(() => toast("\u590D\u5236\u5931\u8D25"))
      }, "\u590D\u5236\u8DEF\u5F84"), React.createElement("a", {
        className: "dsh-rp-btn",
        href: `/api/roleplay/download?sessionId=${encodeURIComponent(sessionId)}&resourceId=${encodeURIComponent(resource.id)}`
      }, "\u4E0B\u8F7D"), isCardReadableResource(resource) ? React.createElement("button", {
        className: "dsh-rp-btn",
        onClick: () => importResource(resource)
      }, "\u8F7D\u5165\u5F53\u524D") : null));
    }));
  }
  function ExportPanel({ sessionId }) {
    const [jobs, setJobs] = React.useState([]), [busy, setBusy] = React.useState(false);
    const refreshSequence = React.useRef(0), refreshInFlight = React.useRef(0), mutationBusy = React.useRef(false);
    const refresh = React.useCallback(() => {
      const ticket = ++refreshSequence.current;
      refreshInFlight.current++;
      return jsonFetch(`/api/roleplay/jobs?sessionId=${encodeURIComponent(sessionId)}`).then((d) => {
        if (ticket === refreshSequence.current)
          setJobs(d.jobs ?? []);
      }).catch(() => {
      }).finally(() => {
        refreshInFlight.current--;
      });
    }, [sessionId]);
    React.useEffect(() => {
      setJobs([]);
      void refresh();
      const timer = setInterval(() => {
        if (!refreshInFlight.current)
          void refresh();
      }, 3e3);
      return () => {
        clearInterval(timer);
        refreshSequence.current++;
      };
    }, [refresh]);
    const start = async (kind) => {
      if (mutationBusy.current)
        return;
      mutationBusy.current = true;
      setBusy(true);
      try {
        await jsonFetch("/api/roleplay/jobs", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            kind
          })
        });
        await refresh();
        toast("\u5DF2\u521B\u5EFA\u5BFC\u51FA\u4EFB\u52A1");
      } catch (e) {
        toast("\u5BFC\u51FA\u4EFB\u52A1\u5931\u8D25\uFF1A" + String(errorMessage2(e)));
      } finally {
        mutationBusy.current = false;
        setBusy(false);
      }
    };
    const action = async (action2, jobId) => {
      if (mutationBusy.current)
        return;
      mutationBusy.current = true;
      setBusy(true);
      try {
        await jsonFetch("/api/roleplay/jobs", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            action: action2,
            jobId
          })
        });
        await refresh();
        toast(action2 === "cancel" ? "\u4EFB\u52A1\u5DF2\u53D6\u6D88" : "\u4EFB\u52A1\u5DF2\u91CD\u8BD5");
      } catch (e) {
        toast("\u4EFB\u52A1\u64CD\u4F5C\u5931\u8D25\uFF1A" + String(errorMessage2(e)));
      } finally {
        mutationBusy.current = false;
        setBusy(false);
      }
    };
    const kindLabels = {
      memory: "\u8BB0\u5FC6\u4E0E\u573A\u666F\u6574\u7406",
      "card-import": "\u8BFB\u53D6\u89D2\u8272\u5361",
      "card-export": "\u5BFC\u51FA\u89D2\u8272\u5361",
      status: "\u72B6\u6001\u680F\u66F4\u65B0",
      decision: "\u51B3\u7B56\u5EFA\u8BAE",
      "novel-export": "\u5BFC\u51FA\u5B8C\u6574\u5C0F\u8BF4"
    };
    const statusLabels = {
      queued: "\u6392\u961F\u4E2D",
      running: "\u5904\u7406\u4E2D",
      "waiting-main": "\u7B49\u5F85\u4E3B\u6A21\u578B",
      failed: "\u5931\u8D25",
      cancelled: "\u5DF2\u53D6\u6D88",
      stale: "\u5206\u652F\u5DF2\u53D8\u5316",
      completed: "\u5DF2\u5B8C\u6210"
    };
    const canCancel = (status) => ["queued", "running", "waiting-main"].includes(status);
    const canRetry = (status) => ["failed", "cancelled"].includes(status);
    const routeText = (job) => {
      const route = job.actualRoute;
      const model = route?.provider && route?.model ? `${route.provider}/${route.model}${route.reasoningEffort ? ` \xB7 ${route.reasoningEffort}` : ""}` : "";
      return model ? `${job.execution === "inline" ? "\u5F53\u524D\u5FAA\u73AF" : "\u4E13\u7528\u6A21\u578B"}\uFF1A${model}` : job.execution === "inline" ? "\u5F53\u524D\u5FAA\u73AF" : "\u4E13\u7528\u6A21\u578B";
    };
    const exportKinds = /* @__PURE__ */ new Set(["card-export", "novel-export"]);
    const topJobs = jobs.filter((job) => !job.parentJobId && exportKinds.has(job.kind));
    const exportJobIds = new Set(topJobs.map((job) => job.id));
    const childJobs = jobs.filter((job) => job.parentJobId && exportJobIds.has(job.parentJobId)), [showSteps, setShowSteps] = React.useState(false);
    const childrenByParent = /* @__PURE__ */ new Map();
    if (showSteps)
      for (const child of childJobs) {
        const siblings = childrenByParent.get(child.parentJobId) ?? [];
        siblings.push(child);
        childrenByParent.set(child.parentJobId, siblings);
      }
    const visibleJobs = showSteps ? topJobs.flatMap((job) => [job, ...childrenByParent.get(job.id) ?? []]) : topJobs;
    const renderJob = (job) => React.createElement("div", {
      className: job.parentJobId ? "dsh-rp-item dsh-rp-job-step" : "dsh-rp-item",
      key: job.id
    }, `${job.parentJobId ? "\u2514\u2500 " : ""}${kindLabels[job.kind] ?? "\u4EFB\u52A1"} \xB7 ${statusLabels[job.status] ?? "\u5904\u7406\u4E2D"} \xB7 ${job.progress?.done ?? 0}/${job.progress?.total ?? 0}`, React.createElement("div", {
      className: "dsh-rp-muted"
    }, routeText(job)), job.error ? React.createElement("div", {
      className: "dsh-rp-error"
    }, String(job.error).slice(0, 500)) : null, job.status === "stale" ? React.createElement("div", {
      className: "dsh-rp-muted"
    }, "\u5F53\u524D\u5206\u652F\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u5BFC\u51FA") : null, React.createElement("div", {
      className: "dsh-rp-row"
    }, job.status === "completed" && job.resourceId ? React.createElement("a", {
      className: "dsh-rp-btn",
      href: `/api/roleplay/download?sessionId=${encodeURIComponent(sessionId)}&resourceId=${encodeURIComponent(job.resourceId)}`
    }, "\u4E0B\u8F7D\u6587\u4EF6") : null, canRetry(job.status) ? React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: busy,
      onClick: () => action("retry", job.id)
    }, "\u91CD\u8BD5") : null, canCancel(job.status) ? React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: busy,
      onClick: () => action("cancel", job.id)
    }, "\u53D6\u6D88") : null));
    return React.createElement("div", {
      className: "dsh-rp-panel"
    }, React.createElement("h4", null, "\u5BFC\u51FA"), React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: busy,
      onClick: () => start("card-export")
    }, "\u5BFC\u51FA\u89D2\u8272\u5361"), React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: busy,
      onClick: () => start("novel-export")
    }, "\u5BFC\u51FA\u5B8C\u6574\u5C0F\u8BF4"), childJobs.length ? React.createElement("button", {
      className: "dsh-rp-btn",
      onClick: () => setShowSteps((value) => !value)
    }, showSteps ? "\u9690\u85CF\u5904\u7406\u6B65\u9AA4" : "\u663E\u793A\u5904\u7406\u6B65\u9AA4") : null), visibleJobs.map(renderJob));
  }
  return {
    CharacterClusterPanel,
    ModelPanel,
    ResourcesPanel,
    ExportPanel
  };
}

// preset-panel.js
function presetConversationChoices(snapshot, catalog, isRoleplaySession) {
  const visible = projectConversationList(snapshot, catalog);
  return (visible.ids ?? []).filter((id) => visible.byId?.[id]?.origin !== "subagent" && (isRoleplaySession(id) || isRoleplaySession(resolveConversationExecution(id, catalog)))).map((id) => ({ id: resolveConversationExecution(id, catalog), label: String(visible.byId?.[id]?.title ?? visible.byId?.[id]?.displayTitle ?? `\u5BF9\u8BDD ${id.slice(-8)}`) }));
}
var modes = [["system", "\u6CBF\u7528\u7CFB\u7EDF\u7F8E\u5B66"], ["blend", "\u878D\u5408\u5361\u7247\u6587\u98CE"], ["card", "\u5B8C\u5168\u91C7\u7528\u5361\u7247\u6587\u98CE"]];
var describe = (mode) => mode === "system" ? "\u4E0D\u6CE8\u5165\u5361\u7247\u7684\u53D9\u4E8B\u89C4\u5219\u3001\u56DE\u590D\u89C4\u5219\u3001\u6587\u98CE\u793A\u4F8B\u3002" : mode === "blend" ? "\u540C\u65F6\u6CE8\u5165\u9884\u8BBE\u548C\u5361\u7247\u6587\u98CE\uFF1B\u51B2\u7A81\u65F6\u9884\u8BBE\u4F18\u5148\u3002" : "\u53EA\u91C7\u7528\u5361\u7247\u6587\u98CE\uFF0C\u4E0D\u6CE8\u5165\u9884\u8BBE\u6B63\u6587\u3002";
function createPresetPanel({ React, jsonFetch, toast, confirmWithDialog: confirmWithDialog2, conversations }) {
  const h = React.createElement;
  function Editor({ sessionId, scope, onLocked }) {
    const [data, setData] = React.useState(null);
    const [selected, setSelected] = React.useState(""), [mode, setMode] = React.useState("system");
    const [draft, setDraft] = React.useState(null);
    const [creating, setCreating] = React.useState(false), [busy, setBusy] = React.useState(false), [error, setError] = React.useState("");
    const sequence = React.useRef(0);
    const accept = (value) => {
      setData(value);
      const selection = scope === "global" ? value.global : value.effective;
      setSelected(selection.presetId);
      setMode(selection.mode);
    };
    const load = async () => {
      const ticket = ++sequence.current;
      setBusy(true);
      setError("");
      try {
        const value = await jsonFetch(`/api/roleplay/presets?sessionId=${encodeURIComponent(sessionId)}`);
        if (ticket === sequence.current)
          accept(value);
      } catch (e) {
        if (ticket === sequence.current)
          setError(String(e.message));
      } finally {
        if (ticket === sequence.current)
          setBusy(false);
      }
    };
    React.useEffect(() => {
      void load();
      return () => {
        sequence.current++;
      };
    }, [sessionId, scope]);
    React.useEffect(() => {
      onLocked(busy || !!draft);
      return () => onLocked(false);
    }, [busy, draft]);
    const preset = data?.presets.find((p) => p.id === selected);
    const saved = data && (scope === "global" ? data.global : data.effective);
    const pending = saved && (saved.presetId !== selected || saved.mode !== mode);
    const mutate = async (body) => {
      if (!data || busy)
        return;
      const ticket = ++sequence.current;
      setBusy(true);
      setError("");
      try {
        const value = await jsonFetch("/api/roleplay/presets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, sessionId, expectedRevision: data.revision }) });
        if (ticket !== sequence.current)
          return;
        accept(value);
        setDraft(null);
        setCreating(false);
        if (body.action === "create")
          setSelected(value.presets.find((p) => !data.presets.some((old) => old.id === p.id))?.id ?? value.effective.presetId);
        else if (body.action === "update")
          setSelected(selected);
        toast(body.action === "select" || body.action === "inherit" ? "\u9884\u8BBE\u751F\u6548\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u5C06\u7528\u4E8E\u540E\u7EED\u751F\u6210" : "\u9884\u8BBE\u5E93\u5DF2\u4FDD\u5B58");
      } catch (e) {
        if (ticket === sequence.current)
          setError(String(e.message));
      } finally {
        if (ticket === sequence.current)
          setBusy(false);
      }
    };
    const button = (label, action, disabled = false) => h("button", { className: "dsh-rp-btn", disabled: busy || disabled, onClick: action }, label);
    const discard = () => {
      setDraft(null);
      setCreating(false);
    };
    return h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, error && h("div", { role: "alert", className: "dsh-rp-error" }, error), !data && h("p", { role: "status" }, busy ? "\u6B63\u5728\u8BFB\u53D6\u9884\u8BBE\u2026" : "\u9884\u8BBE\u6682\u65F6\u4E0D\u53EF\u7528"), button("\u5237\u65B0\u9884\u8BBE", () => void load(), !!draft), data && h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, h("p", { className: "dsh-rp-muted", role: "status" }, scope === "global" ? "\u5168\u5C40\u8BBE\u7F6E\u4F9B\u672A\u5355\u72EC\u8986\u76D6\u7684\u5BF9\u8BDD\u7EE7\u627F\u3002" : data.local ? "\u8BE5\u5BF9\u8BDD\u5DF2\u5355\u72EC\u8BBE\u7F6E\uFF0C\u6240\u6709\u4E16\u754C\u7EBF\u5171\u7528\u3002" : "\u8BE5\u5BF9\u8BDD\u5F53\u524D\u7EE7\u627F\u5168\u5C40\u8BBE\u7F6E\u3002"), h("div", { className: "dsh-rp-item", "aria-label": "\u5F53\u524D\u751F\u6548\u89C4\u5219" }, scope === "global" ? `\u5168\u5C40\uFF1A${data.presets.find((p) => p.id === data.global.presetId)?.name} \xB7 ${modes.find((m) => m[0] === data.global.mode)?.[1]}\u3002${describe(data.global.mode)}` : data.summary), h("label", null, "\u9009\u62E9\u9884\u8BBE", h("select", { className: "dsh-rp-input", "aria-label": "\u9009\u62E9\u9884\u8BBE", value: selected, disabled: busy || !!draft, onChange: (e) => setSelected(e.target.value) }, data.presets.map((p) => h("option", { key: p.id, value: p.id }, p.name + (p.readonly ? "\uFF08\u7CFB\u7EDF\uFF09" : ""))))), h("label", null, "\u6587\u98CE\u6A21\u5F0F", h("select", { className: "dsh-rp-input", "aria-label": "\u6587\u98CE\u6A21\u5F0F", value: mode, disabled: busy || !!draft, onChange: (e) => setMode(e.target.value) }, modes.map(([id, label]) => h("option", { key: id, value: id }, label)))), h("p", { className: "dsh-rp-muted" }, describe(mode), mode !== "card" && !preset?.text ? " \u7A7A\u767D\u6B63\u6587\u4E0D\u9644\u52A0\u9884\u8BBE\u6587\u98CE\u8981\u6C42\u3002" : ""), h("div", { className: "dsh-rp-row" }, button("\u5E94\u7528\u5230\u6240\u9009\u8303\u56F4", () => void mutate({ action: "select", scope, selection: { presetId: selected, mode } }), !!draft), scope === "conversation" && button("\u6E05\u9664\u5BF9\u8BDD\u8986\u76D6\uFF0C\u6CBF\u7528\u5168\u5C40", () => void mutate({ action: "inherit", scope }), !!draft || !data.local)), pending && h("p", { className: "dsh-rp-muted" }, "\u9009\u62E9\u5C1A\u672A\u5E94\u7528\u3002\u70B9\u51FB\u201C\u5E94\u7528\u5230\u6240\u9009\u8303\u56F4\u201D\u540E\u751F\u6548\u3002"), h("hr"), h("h4", null, "\u9884\u8BBE\u6B63\u6587"), h("p", { className: "dsh-rp-muted" }, "\u9884\u8BBE\u5E93\u7531\u6240\u6709\u5BF9\u8BDD\u5171\u4EAB\u3002\u4FEE\u6539\u5DF2\u88AB\u4F7F\u7528\u7684\u9884\u8BBE\uFF0C\u4F1A\u5F71\u54CD\u4F7F\u7528\u5B83\u7684\u5BF9\u8BDD\u540E\u7EED\u751F\u6210\u3002\u7CFB\u7EDF\u9884\u8BBE\u53EA\u80FD\u67E5\u770B\u6216\u53E6\u5B58\u526F\u672C\u3002"), h("div", { className: "dsh-rp-row" }, button("\u65B0\u589E\u9884\u8BBE", () => {
      setCreating(true);
      setDraft({ name: "", text: "" });
    }, !!draft), button("\u53E6\u5B58\u526F\u672C", () => {
      setCreating(true);
      setDraft({ name: `${preset?.name ?? ""} \u526F\u672C`, text: preset?.text ?? "" });
    }, !!draft), button("\u4FEE\u6539\u9884\u8BBE", () => {
      setCreating(false);
      setDraft({ name: preset.name, text: preset.text });
    }, !!draft || !preset || preset.readonly), button("\u5220\u9664\u9884\u8BBE", () => {
      void (async () => {
        if (await confirmWithDialog2(document, `\u5220\u9664\u300C${preset?.name}\u300D\uFF1F\u6B63\u5728\u4F7F\u7528\u7684\u9884\u8BBE\u987B\u5148\u5207\u6362\u540E\u624D\u80FD\u5220\u9664\u3002`, { title: "\u5220\u9664\u9884\u8BBE", confirmLabel: "\u5220\u9664" }))
          await mutate({ action: "delete", presetId: selected });
      })();
    }, !!draft || !preset || preset.readonly)), draft && h("label", null, "\u9884\u8BBE\u540D\u79F0", h("input", { className: "dsh-rp-input", "aria-label": "\u9884\u8BBE\u540D\u79F0", value: draft.name, maxLength: 100, disabled: busy, onChange: (e) => setDraft({ ...draft, name: e.target.value }) })), h("textarea", { className: "dsh-rp-input", "aria-label": "\u9876\u5C42\u521B\u4F5C\u63D0\u793A\u8BCD", style: { width: "100%", minHeight: 360, resize: "vertical", lineHeight: 1.65 }, value: draft?.text ?? preset?.text ?? "", readOnly: !draft, disabled: busy, placeholder: "\u7A7A\u767D\u9884\u8BBE\uFF1A\u4E0D\u9644\u52A0\u6587\u98CE\u63D0\u793A\u8BCD", onChange: (e) => draft && setDraft({ ...draft, text: e.target.value }) }), draft && h("div", { className: "dsh-rp-row" }, button("\u4FDD\u5B58\u9884\u8BBE", () => void mutate({ action: creating ? "create" : "update", presetId: selected, preset: draft }), !draft.name.trim()), button("\u53D6\u6D88\u7F16\u8F91", discard))));
  }
  return function PresetPanel({ sessionId }) {
    const [scope, setScope] = React.useState("current"), [target, setTarget] = React.useState(""), [locked, setLocked] = React.useState(false);
    const [targets, setTargets] = React.useState([]), [error, setError] = React.useState("");
    React.useEffect(() => {
      let live = true;
      conversations().then((value) => {
        if (live)
          setTargets(value);
      }).catch((e) => {
        if (live)
          setError(String(e.message));
      });
      return () => {
        live = false;
      };
    }, [sessionId]);
    const actual = scope === "target" ? target : sessionId;
    return h("section", { className: "dsh-rp-panel", "aria-label": "\u9884\u8BBE" }, h("h4", null, "\u9884\u8BBE"), h("label", null, "\u751F\u6548\u8303\u56F4", h("select", { className: "dsh-rp-input", "aria-label": "\u751F\u6548\u8303\u56F4", value: scope, disabled: locked, onChange: (e) => setScope(e.target.value) }, [["current", "\u5F53\u524D\u5BF9\u8BDD"], ["target", "\u6307\u5B9A\u5BF9\u8BDD"], ["global", "\u5168\u5C40"]].map(([id, label]) => h("option", { key: id, value: id }, label)))), scope === "target" && h("label", null, "\u6307\u5B9A\u5BF9\u8BDD", h("select", { className: "dsh-rp-input", "aria-label": "\u6307\u5B9A\u5BF9\u8BDD", value: target, disabled: locked, onChange: (e) => setTarget(e.target.value) }, h("option", { value: "" }, "\u8BF7\u9009\u62E9\u5BF9\u8BDD"), targets.map((item) => h("option", { key: item.id, value: item.id }, item.label)))), scope === "target" && error && h("p", { role: "alert" }, error), actual && h(Editor, { key: `${scope}:${actual}`, sessionId: actual, scope: scope === "global" ? "global" : "conversation", onLocked: setLocked }));
  };
}

// status-rendering.js
function decodeStatusTemplate(value) {
  return String(value ?? "").replace(/\\(?=<\/?[a-z][^>]*>)/gi, "").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&");
}
function statusFactsHtml(value, options = []) {
  const html = String(value ?? "");
  if (!html)
    return html;
  const template = document.createElement("template");
  template.innerHTML = html;
  const root = template.content;
  let changed = false;
  const remove = (element) => {
    element.remove();
    changed = true;
  };
  for (const element of root.querySelectorAll(".rp-status__acts, [data-roleplay-actions]"))
    remove(element);
  const text = (value2) => String(value2 ?? "").replace(/\s+/g, "").replace(/^[❤️♥♡]+/u, "");
  const labels = new Set(options.map((option) => text(option.label)).filter(Boolean));
  for (const heading of root.querySelectorAll("h1,h2,h3,h4,h5,h6,strong,b,span,p,div,summary")) {
    if (!root.contains(heading) || heading.children.length)
      continue;
    if (!/^(?:可以试试|下一步|(?:接下来的)?活动建议|行动建议|可选行动|建议行动|接下来做什么)[：:？?]?(?:[（(]点击可复制[）)])?[：:]?$/.test(text(heading.textContent)))
      continue;
    const row = heading.closest("li");
    const anchor = row && text(row.textContent) === text(heading.textContent) ? row : heading;
    let next = anchor.nextElementSibling;
    if (!next?.matches("ol,ul") && !labels.has(text(next?.textContent)))
      continue;
    if (next?.matches("ol,ul"))
      remove(next);
    else {
      while (next && labels.has(text(next.textContent))) {
        const following = next.nextElementSibling;
        remove(next);
        next = following;
      }
    }
    remove(anchor);
  }
  for (const element of root.querySelectorAll(".f"))
    remove(element);
  return changed ? template.innerHTML : html;
}

// reader-regex.js
function readerRegexTask(task) {
  const limit = (text) => {
    if (typeof text !== "string" || text.length > 2e6)
      throw new Error("size");
    return text;
  };
  const replaceBounded = (text, re2, replacement) => {
    let used = 0, end = 0, count = 0, found;
    const output = [];
    while ((found = re2.exec(text)) !== null) {
      if (++count > 1e5)
        throw new Error("match-limit");
      const groups = found.groups, original = text, offset = found.index, match = found[0], captures = found.slice(1);
      let expandedSize = 0, tokenEnd = 0;
      const expanded = replacement.replace(/\$([$&`']|\d{1,2}|<[^>]*>)/g, (whole, token, index) => {
        let value = whole;
        if (token === "$")
          value = "$";
        else if (token === "&")
          value = match;
        else if (token === "`")
          value = original.slice(0, offset);
        else if (token === "'")
          value = original.slice(offset + match.length);
        else if (token.startsWith("<")) {
          if (groups)
            value = groups[token.slice(1, -1)] ?? "";
        } else {
          const n = Number(token);
          if (n > 0 && n <= captures.length)
            value = captures[n - 1] ?? "";
          else if (token.length === 2 && Number(token[0]) > 0 && Number(token[0]) <= captures.length)
            value = (captures[Number(token[0]) - 1] ?? "") + token[1];
        }
        expandedSize += index - tokenEnd + value.length;
        tokenEnd = index + whole.length;
        if (expandedSize > 2e6)
          throw new Error("size");
        return value;
      });
      used += offset - end + expanded.length;
      output.push(text.slice(end, offset), expanded);
      end = offset + match.length;
      if (used + text.length - end > 2e6)
        throw new Error("size");
      if (!re2.global)
        break;
      if (match === "")
        re2.lastIndex += re2.unicode && text.codePointAt(re2.lastIndex) > 65535 ? 2 : 1;
    }
    output.push(text.slice(end));
    return output.join("");
  };
  const regex = (rule2) => {
    if (typeof rule2?.match !== "string" || !rule2.match || rule2.match.length > 4096 || String(rule2.replace ?? "").length > 65536)
      throw new Error("rule-limit");
    return new RegExp(rule2.match, "g" + String(rule2.flags ?? "").replace(/[gy]/g, ""));
  };
  if (task.op === "source") {
    let output = limit(task.text), matched = false;
    const deferred = [];
    if (!Array.isArray(task.rules) || task.rules.length > 200)
      throw new Error("rule-limit");
    for (const [i, rule2] of task.rules.entries()) {
      let re2;
      try {
        re2 = regex(rule2);
      } catch {
        continue;
      }
      if (re2.test(output)) {
        re2.lastIndex = 0;
        output = limit(replaceBounded(output, re2, String(rule2.replace ?? "")));
        matched = true;
      } else
        deferred.push(i);
    }
    return { output, deferred, matched };
  }
  const rule = task.rule, re = regex(rule), html = limit(task.html);
  if (re.test(html)) {
    re.lastIndex = 0;
    return { kind: "html", html: limit(replaceBounded(html, re, String(rule.replace ?? ""))) };
  }
  if (!rule.match.includes("\u201C") || !rule.match.includes("\u201D"))
    return { kind: "none" };
  if (!Array.isArray(task.nodes) || task.nodes.length > 1e4)
    throw new Error("node-limit");
  const edits = [];
  let size = 0;
  for (const [node, original] of task.nodes.entries()) {
    limit(original);
    const ranges = Array.from(original.matchAll(/(`+)(?!`)[\s\S]*?\1(?!`)/g), (m) => [m.index, m.index + m[0].length]);
    const shadow = original.replace(/"([^"\n]+)"/g, (whole, content, index) => ranges.some(([a, b]) => index < b && index + whole.length > a) ? whole : `\u201C${content}\u201D`);
    if (shadow === original)
      continue;
    const parts = [], sticky = new RegExp(rule.match, "y" + String(rule.flags ?? "").replace(/[gy]/g, ""));
    let cursor = 0, matched = false;
    re.lastIndex = 0;
    for (const match of shadow.matchAll(re)) {
      const i = match.index;
      if (original.slice(i, i + match[0].length) === match[0])
        continue;
      parts.push({ text: original.slice(cursor, i) });
      sticky.lastIndex = i;
      const replaced = limit(replaceBounded(shadow, sticky, String(rule.replace ?? ""))), suffix = shadow.length - i - match[0].length;
      const replacement = replaced.slice(i, suffix ? -suffix : void 0);
      size += replacement.length;
      if (size > 2e6)
        throw new Error("size");
      parts.push({ html: replacement });
      cursor = i + match[0].length;
      matched = true;
    }
    if (matched) {
      parts.push({ text: original.slice(cursor) });
      edits.push({ node, parts });
    }
  }
  return { kind: edits.length ? "quote" : "none", edits };
}
var readerRegexQueue = Promise.resolve();
var readerRegexWorker = null;
function runReaderRegex(task) {
  const run = () => new Promise((resolve, reject) => {
    let timer, worker;
    const stop = (error) => {
      clearTimeout(timer);
      worker?.terminate();
      if (readerRegexWorker === worker)
        readerRegexWorker = null;
      reject(error);
    };
    try {
      if (!readerRegexWorker) {
        const code = `const run=${readerRegexTask.toString()};self.onmessage=e=>{try{self.postMessage({ok:true,value:run(e.data)})}catch{self.postMessage({ok:false})}};`;
        const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
        try {
          readerRegexWorker = new Worker(url);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      worker = readerRegexWorker;
      worker.onmessage = (e) => {
        clearTimeout(timer);
        e.data?.ok ? resolve(e.data.value) : stop(new Error("\u7F8E\u5316\u89C4\u5219\u8D85\u8FC7\u6267\u884C\u9650\u5236"));
      };
      worker.onerror = () => stop(new Error("\u7F8E\u5316\u5DE5\u4F5C\u7EBF\u7A0B\u4E0D\u53EF\u7528"));
      timer = setTimeout(() => stop(new Error("\u7F8E\u5316\u6B63\u5219\u5339\u914D\u8D85\u65F6")), 250);
      worker.postMessage(task);
    } catch (error) {
      stop(error);
    }
  });
  const result = readerRegexQueue.catch(() => {
  }).then(run);
  readerRegexQueue = result.catch(() => {
  });
  return result;
}

// reader-rendering.js
var READER_BASE_CSS = `
.rp-reader-view {
  --rp-reader-paper: rgba(251, 246, 240, .34);
  --rp-reader-ink: #5c5357;
  --rp-reader-muted: #8f8188;
  --rp-reader-dialogue: #b9866d;
  flex: 1; min-height: 0; overflow-y: auto;
  padding: clamp(16px, 2.4vw, 34px) clamp(10px, 2.8vw, 40px) clamp(42px, 6vw, 76px);
  background: linear-gradient(180deg, rgba(247, 241, 235, .18), rgba(239, 233, 226, .12));
  display: flex; flex-direction: column; align-items: center;
}
.rp-reader {
  width: min(1500px, 100%); align-self: center; box-sizing: border-box;
  background: linear-gradient(145deg, rgba(255, 252, 248, .31), var(--rp-reader-paper));
  color: var(--rp-reader-ink);
  border: 1px solid rgba(255, 255, 255, .28); border-radius: 12px;
  box-shadow: 0 16px 42px rgba(123, 108, 104, .055), inset 0 1px 0 rgba(255, 255, 255, .22);
  padding: clamp(26px, 3.5vw, 54px) clamp(22px, 4.8vw, 72px);
  font-size: 17px; line-height: 1.92;
}
.rp-para { margin: 0 0 22px; text-align: justify; text-indent: 0; overflow-wrap: anywhere; }
.rp-page-title {
  display: block; margin: 2px 0 32px; text-align: center;
  font: 600 22px/1.45 Georgia, "Noto Serif SC", "Songti SC", serif; letter-spacing: 4px;
  color: #8f7881; text-shadow: 0 1px 0 rgba(255,255,255,.48);
}
.rp-page-title::before, .rp-page-title::after { content: " \u2500 "; color: rgba(154,110,130,.28); letter-spacing: 0; }
.rp-thought {
  display: block; margin: 12px 0 14px; padding: 8px 14px;
  color: var(--rp-reader-muted); font-style: italic; line-height: 1.9;
  background: rgba(251,246,240,.22); border-left: 2px solid rgba(226,182,200,.58);
  border-radius: 0 8px 8px 0;
  box-shadow: inset 1px 0 0 rgba(255,255,255,.35);
}
.rp-dialogue {
  color: var(--rp-reader-dialogue); font: 400 1em/1.9 "STKaiti", "KaiTi", "Noto Serif SC", serif;
  letter-spacing: .065em; text-indent: 0;
  position: relative; display: inline-block; max-width: 100%; box-sizing: border-box;
  padding: 5px 12px; margin: 3px 0;
  transition: color .18s ease, filter .18s ease;
}
.rp-dialogue::before, .rp-dialogue::after {
  content: ""; position: absolute; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent 0, rgba(185,134,109,.08) 8%, rgba(185,134,109,.34) 25%, rgba(185,134,109,.34) 75%, rgba(185,134,109,.08) 92%, transparent 100%);
  transform: scaleY(.55); transform-origin: center; pointer-events: none;
}
.rp-dialogue::before { top: 0; }
.rp-dialogue::after { bottom: 0; }
.rp-dialogue:hover {
  color: #a86e51;
  animation: rp-dialogue-float .7s ease-in-out infinite;
  filter: drop-shadow(0 3px 4px rgba(178,116,84,.16));
}
@keyframes rp-dialogue-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
.rp-affinity {
  display: inline-flex; align-items: center; margin: 0 4px;
  padding: 1px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #fff;
  background: linear-gradient(90deg, #e2b6c8, #b9c9ea);
  box-shadow: 3px 3px 7px rgba(180,185,200,.5), -3px -3px 7px rgba(255,255,255,.85);
  animation: rp-fade .5s ease-out;
}
@keyframes rp-fade { from { opacity: 0 } to { opacity: 1 } }
.rp-user-line {
  margin: 0 0 16px; padding: 7px 12px; font-size: 13px; color: var(--rp-reader-muted);
  background: rgba(226,182,200,.09); border: 1px solid rgba(255,255,255,.18); border-radius: 8px;
}
.rp-page-break { display: flex; align-items: center; gap: 14px; margin: 24px 0; color: rgba(154,110,130,.55); font-size: 12px; letter-spacing: 4px; }
.rp-page-break::before, .rp-page-break::after { content: ""; flex: 1; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(207,178,124,.5), transparent); }
.rp-reader-empty { margin: auto; color: var(--dsw-alias-label-tertiary, #9a9aa6); font-size: 13px; }
.rp-reader-history { display: flex; justify-content: center; align-items: center; min-height: 32px; margin: 0 0 18px; gap: 8px; font-size: 13px; color: var(--rp-reader-muted); }
.rp-reader-load-older { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border: 1px solid rgba(185,134,109,.28); border-radius: 8px; background: rgba(255,255,255,.28); color: inherit; font: inherit; cursor: pointer; }
.rp-reader-load-older:disabled { cursor: progress; }
.rp-reader-spinner { display: inline-block; width: 14px; height: 14px; flex: none; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: rp-reader-spin .8s linear infinite; }
@keyframes rp-reader-spin { to { transform: rotate(360deg); } }
.rp-reader strong { font-weight: 650; color: color-mix(in srgb, currentColor 88%, #6f5262 12%); }
.rp-reader em { font-style: italic; }
.rp-reader blockquote { margin: 18px 0; padding: 4px 18px; border-left: 2px solid rgba(185,134,109,.32); color: var(--rp-reader-muted); }
.rp-reader ul, .rp-reader ol { margin: 12px 0 20px; padding-left: 1.6em; }
.rp-reader code { padding: 1px 5px; border-radius: 5px; background: rgba(126,102,104,.08); font-size: .9em; }
.rp-reader-message { position: relative; }
.rp-reader-actions {
  display: flex; flex-wrap: wrap; align-items: center; gap: 5px; min-height: 24px;
  margin: -10px 0 18px; opacity: .36; transition: opacity .18s ease;
}
.rp-reader-message:hover > .rp-reader-actions, .rp-reader-actions:focus-within { opacity: 1; }
.rp-reader-message[data-kind="user"] > .rp-reader-actions { justify-content: flex-end; margin-top: -12px; }
.rp-reader-meta { font-size: 11px; line-height: 20px; color: var(--rp-reader-muted); white-space: nowrap; }
@media (max-width: 760px) {
  .rp-reader-view { padding: 10px 4px 38px; }
  .rp-reader { border-color: transparent; border-radius: 8px; padding: 22px 16px 30px; font-size: 16px; line-height: 1.88; box-shadow: none; }
  .rp-para { margin-bottom: 19px; text-align: left; }
  .rp-page-title { font-size: 20px; letter-spacing: 3px; margin-bottom: 24px; }
  .rp-dialogue { letter-spacing: .035em; padding-inline: 7px; }
}
@media (prefers-reduced-motion: reduce) {
  .rp-dialogue { transition: none; }
  .rp-dialogue:hover { animation: none; transform: none; }
  .rp-affinity { animation: none; }
}
`;
function cssBlockEnd(css, openIndex) {
  let depth = 1;
  let quote = "";
  let comment = false;
  for (let i = openIndex + 1; i < css.length; i++) {
    const char = css[i];
    const next = css[i + 1];
    if (comment) {
      if (char === "*" && next === "/") {
        comment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") {
        i++;
        continue;
      }
      if (char === quote)
        quote = "";
      continue;
    }
    if (char === "/" && next === "*") {
      comment = true;
      i++;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{")
      depth++;
    else if (char === "}" && --depth === 0)
      return i;
  }
  return -1;
}
function scopeCssText(css, roots) {
  const input = String(css ?? "");
  let output = "";
  let cursor = 0;
  while (cursor < input.length) {
    const open = input.indexOf("{", cursor);
    if (open < 0) {
      output += input.slice(cursor);
      break;
    }
    const close = cssBlockEnd(input, open);
    if (close < 0) {
      output += input.slice(cursor);
      break;
    }
    const header = input.slice(cursor, open);
    const body = input.slice(open + 1, close);
    const trimmed = header.trim();
    if (/^@(media|supports|container|layer|document)\b/i.test(trimmed)) {
      output += header + "{" + scopeCssText(body, roots) + "}";
    } else if (trimmed.startsWith("@")) {
      output += header + "{" + body + "}";
    } else {
      const leading = header.match(/^\s*/)?.[0] ?? "";
      const selectors = header.slice(leading.length).split(",").map((selector) => {
        const value = selector.trim();
        if (!value)
          return "";
        if (roots.some((root) => value === root || value.startsWith(root + " ") || value.startsWith(root + ":") || value.startsWith(root + "[")))
          return value;
        if (value === ":root" || value === "html" || value === "body")
          return roots.join(", ");
        return roots.map((root) => root + " " + value).join(", ");
      }).filter(Boolean).join(", ");
      output += leading + selectors + "{" + body + "}";
    }
    cursor = close + 1;
  }
  return output;
}
function scopeHtmlStyles(html, roots) {
  return String(html ?? "").replace(/<style(\s[^>]*)?>([\s\S]*?)<\/style>/gi, (_match, attributes = "", css) => "<style" + attributes + ">" + scopeCssText(css, roots) + "</style>");
}
function scopeReaderCss(css) {
  return scopeCssText(css, [".rp-reader-view"]);
}
var READER_ALLOWED_TAGS = /* @__PURE__ */ new Set([
  "A",
  "ARTICLE",
  "B",
  "BLOCKQUOTE",
  "BR",
  "BUTTON",
  "CAPTION",
  "CITE",
  "CODE",
  "DD",
  "DETAILS",
  "DIV",
  "DL",
  "DT",
  "EM",
  "FIGCAPTION",
  "FIGURE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "I",
  "KBD",
  "LI",
  "MARK",
  "OL",
  "P",
  "PRE",
  "Q",
  "RP",
  "RT",
  "RUBY",
  "S",
  "SAMP",
  "SECTION",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUMMARY",
  "SUP",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TIME",
  "TR",
  "U",
  "UL",
  "VAR",
  "WBR"
]);
var READER_DROP_TAGS = /* @__PURE__ */ new Set([
  "BASE",
  "CANVAS",
  "EMBED",
  "FORM",
  "IFRAME",
  "INPUT",
  "LINK",
  "MATH",
  "META",
  "NOSCRIPT",
  "OBJECT",
  "OPTION",
  "SCRIPT",
  "SELECT",
  "SOURCE",
  "STYLE",
  "SVG",
  "TEMPLATE",
  "TEXTAREA",
  "VIDEO",
  "AUDIO"
]);
var READER_BLOCK_TAGS = /* @__PURE__ */ new Set([
  "ARTICLE",
  "BLOCKQUOTE",
  "CAPTION",
  "DD",
  "DETAILS",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "LI",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "SUMMARY",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "UL"
]);
var READER_PARAGRAPH_CONTAINERS = /* @__PURE__ */ new Set([
  "ARTICLE",
  "BLOCKQUOTE",
  "CAPTION",
  "DD",
  "DIV",
  "DT",
  "FIGCAPTION",
  "LI",
  "SECTION",
  "TD",
  "TH"
]);
var READER_SAFE_ATTRIBUTES = /* @__PURE__ */ new Set([
  "class",
  "colspan",
  "dir",
  "id",
  "lang",
  "open",
  "role",
  "rowspan",
  "style",
  "title"
]);
var READER_BLOCKED_STYLE_PROPERTIES = /* @__PURE__ */ new Set([
  "behavior",
  "bottom",
  "clip",
  "clip-path",
  "content",
  "cursor",
  "inset",
  "inset-block",
  "inset-inline",
  "left",
  "mask",
  "mask-image",
  "-moz-binding",
  "pointer-events",
  "right",
  "src",
  "top",
  "z-index"
]);
function sanitizeReaderStyle(styleText) {
  const parsed = document.createElement("span");
  const safe = document.createElement("span");
  parsed.style.cssText = String(styleText ?? "");
  for (const name of Array.from(parsed.style)) {
    const value = parsed.style.getPropertyValue(name);
    const priority = parsed.style.getPropertyPriority(name);
    const probe = (name + ":" + value).toLowerCase().replace(/\s+/g, "");
    if (READER_BLOCKED_STYLE_PROPERTIES.has(name))
      continue;
    if (/(?:url|image-set|expression|javascript|vbscript|@import)\(/i.test(probe))
      continue;
    if (name === "position" && !/^(?:static|relative)$/i.test(value.trim()))
      continue;
    safe.style.setProperty(name, value, priority);
  }
  return safe.style.cssText;
}
function sanitizeReaderTree(root) {
  for (const element of Array.from(root.querySelectorAll("*"))) {
    if (!element.parentNode)
      continue;
    const tag = element.tagName;
    if (READER_DROP_TAGS.has(tag)) {
      element.remove();
      continue;
    }
    if (!READER_ALLOWED_TAGS.has(tag)) {
      const parent = element.parentNode;
      while (element.firstChild)
        parent.insertBefore(element.firstChild, element);
      element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const allowed = READER_SAFE_ATTRIBUTES.has(name) || name.startsWith("aria-") || name.startsWith("data-");
      if (!allowed || name.startsWith("on") || name === "srcdoc" || name === "href" || name === "src" || name === "xlink:href") {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (name === "style") {
        const clean = sanitizeReaderStyle(attribute.value);
        if (clean)
          element.setAttribute("style", clean);
        else
          element.removeAttribute("style");
      }
    }
    if (tag === "BUTTON")
      element.setAttribute("type", "button");
  }
}
function paragraphizeReaderContainer(container) {
  const output = document.createDocumentFragment();
  let paragraph = null;
  const ensureParagraph = () => {
    if (!paragraph) {
      paragraph = document.createElement("p");
      paragraph.className = "rp-para";
    }
    return paragraph;
  };
  const flushParagraph = () => {
    if (!paragraph)
      return;
    if (paragraph.textContent?.trim() || paragraph.querySelector("br,button"))
      output.appendChild(paragraph);
    paragraph = null;
  };
  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType === 3) {
      for (const chunk of String(child.nodeValue ?? "").split(/(\r?\n+)/)) {
        if (/^\r?\n+$/.test(chunk)) {
          flushParagraph();
        } else if (chunk.trim()) {
          ensureParagraph().appendChild(document.createTextNode(chunk));
        } else if (paragraph) {
          paragraph.appendChild(document.createTextNode(chunk));
        }
      }
      continue;
    }
    if (child.nodeType !== 1)
      continue;
    const element = child;
    if (READER_BLOCK_TAGS.has(element.tagName)) {
      flushParagraph();
      if (READER_PARAGRAPH_CONTAINERS.has(element.tagName))
        paragraphizeReaderContainer(element);
      output.appendChild(child);
    } else {
      ensureParagraph().appendChild(child);
    }
  }
  flushParagraph();
  container.replaceChildren(output);
}
function decorateReaderSemantics(root) {
  for (const heading of root.querySelectorAll("h1,h2,h3"))
    heading.classList.add("rp-page-title");
  const textNodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode())
    textNodes.push(walker.currentNode);
  const dialoguePattern = /(“[^”\n]+”|「[^」\n]+」|『[^』\n]+』|"[^"\n]+")/g;
  for (const node of textNodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest(".rp-dialogue,code,pre,h1,h2,h3,h4,h5,h6"))
      continue;
    const paragraph = parent.closest(".rp-para");
    if (!paragraph)
      continue;
    const paragraphText = String(paragraph.textContent ?? "").trimStart();
    if (!/^(?:“|「|『|")/.test(paragraphText) && !/[:：]\s*(?:“|「|『|")/.test(paragraphText))
      continue;
    const authorSpan = parent.closest("span[class],span[style]");
    if (authorSpan) {
      if (!authorSpan.querySelector("code,pre") && /^(?:“[^”\n]+”|「[^」\n]+」|『[^』\n]+』|"[^"\n]+")$/.test(authorSpan.textContent.trim()))
        authorSpan.classList.add("rp-dialogue");
      continue;
    }
    const text = node.nodeValue ?? "";
    const codeRanges = Array.from(text.matchAll(/(`+)(?!`)[\s\S]*?\1(?!`)/g), (match) => [match.index, match.index + match[0].length]);
    dialoguePattern.lastIndex = 0;
    if (!dialoguePattern.test(text))
      continue;
    dialoguePattern.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(dialoguePattern)) {
      const index = match.index ?? 0;
      const end = index + match[0].length;
      if (codeRanges.some(([start, codeEnd]) => index < codeEnd && end > start))
        continue;
      if (index > cursor)
        fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
      const span = document.createElement("span");
      span.className = "rp-dialogue";
      span.textContent = match[0];
      fragment.appendChild(span);
      cursor = index + match[0].length;
    }
    if (cursor < text.length)
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }
}
function applyReaderInlineMarkdown(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode())
    nodes.push(walker.currentNode);
  const tokenPattern = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|\*[^*\n]+\*|_[^_\n]+_)/g;
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("code,pre,script,style,.rp-reader-actions"))
      continue;
    const text = String(node.nodeValue ?? "");
    tokenPattern.lastIndex = 0;
    if (!tokenPattern.test(text))
      continue;
    tokenPattern.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(tokenPattern)) {
      const index = match.index ?? 0;
      if (index > cursor)
        fragment.appendChild(document.createTextNode(text.slice(cursor, index)));
      const token = match[0];
      let element;
      if (token.startsWith("**") || token.startsWith("__")) {
        element = document.createElement("strong");
        element.textContent = token.slice(2, -2);
      } else if (token.startsWith("~~")) {
        element = document.createElement("s");
        element.textContent = token.slice(2, -2);
      } else if (token.startsWith("`")) {
        element = document.createElement("code");
        element.textContent = token.slice(1, -1);
      } else if (token.startsWith("[")) {
        const parsed = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        element = document.createElement("a");
        element.textContent = parsed?.[1] ?? token;
        if (parsed?.[2]) {
          element.href = parsed[2];
          element.target = "_blank";
          element.rel = "noopener noreferrer";
        }
      } else {
        element = document.createElement("em");
        element.textContent = token.slice(1, -1);
      }
      fragment.appendChild(element);
      cursor = index + token.length;
    }
    if (cursor < text.length)
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }
}
function applyReaderBlockMarkdown(root) {
  for (const paragraph of Array.from(root.querySelectorAll("p.rp-para"))) {
    if (paragraph.children.length > 0)
      continue;
    const text = String(paragraph.textContent ?? "");
    const heading = text.match(/^(#{1,6})\s+([\s\S]+)$/);
    if (heading) {
      const h = document.createElement(`h${heading[1].length}`);
      h.textContent = heading[2];
      paragraph.replaceWith(h);
      continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(text)) {
      paragraph.replaceWith(document.createElement("hr"));
      continue;
    }
    const quote = text.match(/^>\s?([\s\S]+)$/);
    if (quote) {
      const blockquote = document.createElement("blockquote");
      blockquote.textContent = quote[1];
      paragraph.replaceWith(blockquote);
    }
  }
}
async function renderReaderNarrativeAsync(raw, rules, run = runReaderRegex) {
  const source = await run({ op: "source", text: String(raw ?? ""), rules: Array.isArray(rules) ? rules : [] });
  const template = document.createElement("template");
  template.innerHTML = source.output.replace(/\\(?=<\/?[a-z][^>]*>)/gi, "").replace(/&lt;(\/?[a-z][^&]*?)&gt;/gi, "<$1>").replace(/\\(\*{1,2}|_{1,2}|~~|`)/g, "$1").replace(/^\\(#{1,6}|[-*+]|>)(?=\s)/gm, "$1");
  sanitizeReaderTree(template.content);
  paragraphizeReaderContainer(template.content);
  applyReaderBlockMarkdown(template.content);
  const after = [];
  for (const i of source.deferred) {
    const rule = rules[i], nodes = [], walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    while (walker.nextNode())
      if (walker.currentNode.parentElement && !walker.currentNode.parentElement.closest("code,pre,script,style"))
        nodes.push(walker.currentNode);
    const result = await run({ op: "fallback", html: template.innerHTML, rule, nodes: nodes.map((n) => n.nodeValue ?? "") });
    if (result.kind === "html")
      template.innerHTML = result.html;
    else if (result.kind === "quote")
      for (const edit of result.edits) {
        const fragment = document.createDocumentFragment();
        for (const part of edit.parts) {
          if (part.text !== void 0)
            fragment.appendChild(document.createTextNode(part.text));
          else {
            const t = document.createElement("template");
            t.innerHTML = part.html;
            fragment.appendChild(t.content);
          }
        }
        nodes[edit.node].replaceWith(fragment);
      }
    else
      after.push(rule);
  }
  sanitizeReaderTree(template.content);
  paragraphizeReaderContainer(template.content);
  decorateReaderSemantics(template.content);
  applyReaderInlineMarkdown(template.content);
  if (after.length) {
    const result = await run({ op: "source", text: template.innerHTML, rules: after });
    if (result.matched) {
      template.innerHTML = result.output;
      sanitizeReaderTree(template.content);
      paragraphizeReaderContainer(template.content);
      decorateReaderSemantics(template.content);
    }
  }
  return template.innerHTML;
}
function applyReaderQuoteFallback(root, rule) {
  if (!rule.match.includes("\u201C") || !rule.match.includes("\u201D"))
    return false;
  let changed = false;
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode())
    nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (!node.parentElement || node.parentElement.closest("code,pre,script,style"))
      continue;
    const original = node.nodeValue ?? "";
    const codeRanges = Array.from(original.matchAll(/(`+)(?!`)[\s\S]*?\1(?!`)/g), (match) => [match.index, match.index + match[0].length]);
    const shadow = original.replace(/"([^"\n]+)"/g, (whole, content, index) => {
      const end = index + whole.length;
      return codeRanges.some(([start, codeEnd]) => index < codeEnd && end > start) ? whole : `\u201C${content}\u201D`;
    });
    if (shadow === original)
      continue;
    const fragment = document.createDocumentFragment();
    const sticky = new RegExp(rule.match, "y");
    let cursor = 0, matched = false;
    for (const match of shadow.matchAll(new RegExp(rule.match, "g"))) {
      const index = match.index;
      if (original.slice(index, index + match[0].length) === match[0])
        continue;
      fragment.appendChild(document.createTextNode(original.slice(cursor, index)));
      sticky.lastIndex = index;
      const replaced = shadow.replace(sticky, String(rule.replace ?? ""));
      const suffixLength = shadow.length - index - match[0].length;
      const replacement = document.createElement("template");
      replacement.innerHTML = replaced.slice(index, suffixLength ? -suffixLength : void 0);
      fragment.appendChild(replacement.content);
      cursor = index + match[0].length;
      matched = true;
    }
    if (matched) {
      fragment.appendChild(document.createTextNode(original.slice(cursor)));
      node.replaceWith(fragment);
      changed = true;
    }
  }
  return changed;
}
function applyReaderHtmlRule(template, rule) {
  const regex = new RegExp(rule.match, "g");
  if (!regex.test(template.innerHTML))
    return false;
  regex.lastIndex = 0;
  template.innerHTML = template.innerHTML.replace(regex, String(rule.replace ?? ""));
  return true;
}
function renderReaderNarrative(raw, rules) {
  let output = String(raw ?? "");
  const deferred = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    try {
      if (typeof rule?.match !== "string")
        continue;
      const regex = new RegExp(rule.match, "g");
      if (regex.test(output)) {
        regex.lastIndex = 0;
        output = output.replace(regex, String(rule.replace ?? ""));
      } else
        deferred.push(rule);
    } catch {
    }
  }
  output = output.replace(/\\(?=<\/?[a-z][^>]*>)/gi, "").replace(/&lt;(\/?[a-z][^&]*?)&gt;/gi, "<$1>").replace(/\\(\*{1,2}|_{1,2}|~~|`)/g, "$1").replace(/^\\(#{1,6}|[-*+]|>)(?=\s)/gm, "$1");
  const template = document.createElement("template");
  template.innerHTML = output;
  sanitizeReaderTree(template.content);
  paragraphizeReaderContainer(template.content);
  applyReaderBlockMarkdown(template.content);
  const afterInline = [];
  for (const rule of deferred) {
    try {
      if (!applyReaderHtmlRule(template, rule) && !applyReaderQuoteFallback(template.content, rule))
        afterInline.push(rule);
    } catch {
    }
  }
  sanitizeReaderTree(template.content);
  paragraphizeReaderContainer(template.content);
  decorateReaderSemantics(template.content);
  applyReaderInlineMarkdown(template.content);
  let inlineMatched = false;
  for (const rule of afterInline) {
    try {
      if (applyReaderHtmlRule(template, rule))
        inlineMatched = true;
    } catch {
    }
  }
  if (inlineMatched) {
    sanitizeReaderTree(template.content);
    paragraphizeReaderContainer(template.content);
    decorateReaderSemantics(template.content);
  }
  return template.innerHTML;
}

// ../status-template.js
function cardCodeBlocks(value) {
  const blocks = [];
  const outside = [];
  let fence = null;
  for (const line of String(value ?? "").replace(/\r\n/g, "\n").split("\n")) {
    if (!fence) {
      const open = line.match(/^ {0,3}(`{3,}|~{3,})([^\n]*)$/);
      if (open)
        fence = { marker: open[1][0], length: open[1].length, language: open[2].trim().toLowerCase(), lines: [] };
      else
        outside.push(line);
      continue;
    }
    const close = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
    if (close && close[1][0] === fence.marker && close[1].length >= fence.length) {
      blocks.push({ language: fence.language, code: fence.lines.join("\n") });
      fence = null;
    } else
      fence.lines.push(line);
  }
  return { blocks, outside: outside.join("\n"), unclosed: fence?.language ?? null };
}
function restoreStatusTemplateCss(html, template) {
  const existing = new Set([...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((match) => match[1].replace(/\r\n/g, "\n").trim()));
  const styles = [];
  for (const block of cardCodeBlocks(template).blocks) {
    if (block.language !== "css")
      continue;
    const css = block.code.trim().replace(/<\/style/gi, "<\\/style");
    if (!css || existing.has(css))
      continue;
    existing.add(css);
    styles.push("<style>" + css + "</style>");
  }
  return styles.join("\n") + (styles.length ? "\n" : "") + html;
}

// reader-model.js
var isRecord = (value) => !!value && typeof value === "object";
var textAlias = (value, keys) => {
  if (!isRecord(value))
    return "";
  for (const key of keys) {
    const text = value[key];
    if (text !== void 0 && text !== null && String(text).trim())
      return String(text).trim();
  }
  return "";
};
function normalizeField(field) {
  const source = isRecord(field) ? field : {};
  return {
    ...source,
    emoji: textAlias(source, ["emoji", "icon", "chip"]),
    label: textAlias(source, ["label", "name", "key", "reason", "title"]),
    value: textAlias(source, ["value", "text", "content", "description", "detail"])
  };
}
function normalizeOption(option) {
  const source = isRecord(option) ? option : {};
  return {
    ...source,
    label: textAlias(source, ["label", "text", "value", "reason", "content", "name", "title"]),
    description: textAlias(source, ["description", "detail", "desc"]),
    heart: source.heart === true
  };
}
var normalizeOptions = (value) => Array.isArray(value) ? value.map(normalizeOption).filter((option) => option.label).slice(0, 4) : [];
function normalizePanel(value) {
  const record = isRecord(value) ? value.record ?? value : void 0;
  const source = isRecord(record) ? record.panel ?? record : void 0;
  if (!isRecord(source))
    return null;
  const templateHtml = source.html ?? source.templateHtml ?? source.template ?? "";
  const recordValue = isRecord(record) ? record : {};
  const atSeqValue = recordValue.atSeq ?? source.atSeq;
  const timeValue = recordValue.time ?? source.time;
  return {
    ...source,
    atSeq: Number.isFinite(Number(atSeqValue)) ? Number(atSeqValue) : -1,
    turnId: recordValue.turnId ?? source.turnId ?? null,
    time: Number.isFinite(Number(timeValue)) ? Number(timeValue) : 0,
    title: textAlias(source, ["title", "name", "rawText"]),
    html: typeof templateHtml === "string" && templateHtml.trim() ? restoreStatusTemplateCss(decodeStatusTemplate(templateHtml), source.templateHtml ?? source.template) : "",
    fields: Array.isArray(source.fields) ? source.fields.map(normalizeField) : [],
    options: normalizeOptions(source.options)
  };
}
function normalizeDecision(value) {
  const sourceValue = isRecord(value) ? value.record ?? value : void 0;
  if (!isRecord(sourceValue))
    return null;
  return {
    ...sourceValue,
    options: normalizeOptions(sourceValue.options)
  };
}
function userValuesFromState(state) {
  const stateRecord = isRecord(state) ? state : {};
  const info = isRecord(stateRecord.userinfo) ? stateRecord.userinfo : null;
  const cards = Array.isArray(stateRecord.cards) ? stateRecord.cards : [];
  const playerCard = cards.find((card) => {
    if (!isRecord(card))
      return false;
    return card.kind === "user" || card.id === "user" || card.card_id === "user";
  });
  const cardRecord = isRecord(playerCard) ? playerCard : {};
  const rawCardName = String(cardRecord.name ?? "").trim();
  const cardName = /\{\{\s*(?:user|user_name)\s*\}\}/i.test(rawCardName) ? "" : rawCardName;
  return {
    name: String(info?.name ?? "").trim() || cardName || "\u7528\u6237",
    gender: String(info?.gender ?? "").trim()
  };
}
function renderUserVars(text, state) {
  const values = userValuesFromState(state);
  let output = String(text ?? "").replace(/\{\{\s*(?:user[_-]gender|userGender)\s*\}\}/gi, values.gender).replace(/\{\{\s*(?:user|user_name)\s*\}\}/gi, values.name);
  output = output.replace(/无名客\s*\/\s*男/g, values.name + " / " + (values.gender || "\u7537"));
  if (values.name !== "\u65E0\u540D\u5BA2")
    output = output.replace(/无名客/g, values.name);
  return output;
}
var readCollectionValue = (value, key) => {
  if (!isRecord(value) || typeof value.get !== "function")
    return void 0;
  return value.get(key);
};
var readCollectionValues = (value) => {
  if (!isRecord(value) || typeof value.values !== "function")
    return [];
  const result = value.values();
  return Array.from(result);
};
function normalizeConversationNodes(snapshot) {
  const sourceValue = isRecord(snapshot) ? snapshot.snapshot ?? snapshot : snapshot;
  if (!isRecord(sourceValue) && !Array.isArray(sourceValue))
    return [];
  const source = sourceValue;
  let list = [];
  let chat = null;
  if (isRecord(source) && isRecord(source.views)) {
    try {
      chat = readCollectionValue(source.views, "chat");
    } catch {
    }
  }
  if (isRecord(chat) && Array.isArray(chat.order) && isRecord(chat.nodes) && typeof chat.nodes.get === "function") {
    list = chat.order.map((key) => readCollectionValue(chat.nodes, key)).filter(Boolean);
  } else if (isRecord(chat) && Array.isArray(chat.nodes))
    list = chat.nodes;
  else if (isRecord(chat) && isRecord(chat.nodes) && typeof chat.nodes.values === "function")
    list = readCollectionValues(chat.nodes);
  else if (isRecord(chat) && isRecord(chat.legacy) && Array.isArray(chat.legacy.nodes))
    list = chat.legacy.nodes;
  else if (Array.isArray(source))
    list = source;
  else {
    const candidates = ["nodes", "messages", "events", "items", "transcript", "records", "entries"];
    const found = candidates.map((key) => source[key]).find(Array.isArray);
    list = Array.isArray(found) ? found : [];
  }
  return list.filter(Boolean).map((item) => {
    if (!isRecord(item))
      return item;
    const role = String(item.role ?? (isRecord(item.author) ? item.author.role : void 0) ?? "").toLowerCase();
    const type = String(item.kind ?? item.type ?? item.eventType ?? "").toLowerCase();
    const kind = type.includes("user") || role === "user" ? "user" : type.includes("assistant") || type.includes("narrator") || role === "assistant" ? "assistant" : item.kind;
    if (isRecord(item.data))
      return { ...item, kind };
    const content = item.content ?? item.text ?? item.message;
    return { ...item, kind, data: { text: typeof content === "string" ? content : "" } };
  });
}
function textFromNodeValue(value, depth = 0) {
  if (depth > 5 || value === null || value === void 0)
    return "";
  if (typeof value === "string")
    return value;
  if (Array.isArray(value)) {
    return value.filter((item) => !isRecord(item) || item.kind === void 0 || item.kind === "text" || item.type === "text").map((item) => textFromNodeValue(item, depth + 1)).filter(Boolean).join("\n");
  }
  if (!isRecord(value))
    return "";
  for (const key of ["text", "content", "body", "value", "message"]) {
    const text = textFromNodeValue(value[key], depth + 1);
    if (text)
      return text;
  }
  for (const key of ["blocks", "parts", "items"]) {
    const text = textFromNodeValue(value[key], depth + 1);
    if (text)
      return text;
  }
  return "";
}
function readerText(node) {
  if (!isRecord(node))
    return "";
  const kind = String(node.kind ?? node.type ?? "").toLowerCase();
  if (kind === "user" || kind === "steering") {
    const data = isRecord(node.data) ? node.data : {};
    const blocks = data.content ?? node.content;
    if (Array.isArray(blocks)) {
      return blocks.filter((block) => isRecord(block) && (block.type === "text" || block.kind === "text")).map((block) => String(isRecord(block) ? block.text ?? block.value ?? "" : "")).filter(Boolean).join("\n");
    }
  }
  if (kind === "assistant-step" || kind === "assistant" || kind === "narrator") {
    const data = isRecord(node.data) ? node.data : {};
    const blocks = data.blocks ?? node.blocks;
    if (Array.isArray(blocks)) {
      return blocks.filter((block) => isRecord(block) && (block.kind === "text" || block.type === "text")).map((block) => String(isRecord(block) ? block.text ?? block.value ?? "" : "")).filter(Boolean).join("\n");
    }
  }
  return textFromNodeValue(node.data ?? node);
}
function readerNodeSeq(node) {
  const record = isRecord(node) ? node : {};
  const data = isRecord(record.data) ? record.data : {};
  const finalNode = isRecord(data.finalNode) ? data.finalNode : {};
  const seq = Number(finalNode.seq ?? data.seq ?? record.seq);
  return Number.isSafeInteger(seq) ? seq : null;
}
function readerMessageId(node) {
  const record = isRecord(node) ? node : {};
  const data = isRecord(record.data) ? record.data : {};
  const finalNode = isRecord(data.finalNode) ? data.finalNode : {};
  const value = finalNode.messageId ?? data.messageId;
  return value === void 0 || value === null ? "" : String(value);
}
function readerTime(node) {
  const record = isRecord(node) ? node : {};
  const data = isRecord(record.data) ? record.data : {};
  const value = Number(data.time ?? record.time);
  return Number.isFinite(value) ? value : 0;
}
function formatReaderTime(value) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0)
    return "";
  try {
    return new Intl.DateTimeFormat(void 0, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(Number(value)));
  } catch {
    return "";
  }
}
function usageTokens(usage) {
  if (!isRecord(usage))
    return null;
  const keys = ["totalTokens", "total_tokens", "inputTokens", "input_tokens", "outputTokens", "output_tokens"];
  const values = keys.map((key) => Number(usage[key])).filter(Number.isFinite);
  if (!values.length)
    return null;
  const explicit = Number(usage.totalTokens ?? usage.total_tokens);
  return Number.isFinite(explicit) ? explicit : values.reduce((sum, value) => sum + value, 0);
}

// activity-view.js
var ACTIVITY_CSS = `
.rp-activity{display:flex;align-items:center;gap:12px;margin:20px auto;padding:14px 18px;max-width:var(--dsh-chat-content-width,900px);box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#ddd);border-radius:14px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#333);font:inherit;box-shadow:var(--dsw-shadow-lv1,0 2px 8px #00000006)}
.rp-activity strong{font-weight:500}.rp-activity small{display:block;font-size:12px;color:var(--dsw-alias-label-caption,#888);margin-top:4px}.rp-activity time{margin-left:auto;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-label-caption,#888)}.rp-activity-whale{font-size:24px;animation:rp-whale-breathe 2.4s ease-in-out infinite}
.rp-pending-player{width:fit-content;max-width:85%;margin:16px 0 16px auto;padding:12px 18px;border-radius:14px;background:var(--dsw-alias-interactive-bg-hover-solid,#efede8);color:var(--dsw-alias-label-primary,#333);white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.rp-pending-player small{display:block;margin-top:6px;font-size:12px;color:var(--dsw-alias-label-caption,#888)}
@keyframes rp-whale-breathe{50%{transform:translateY(-3px)}}@media(prefers-reduced-motion:reduce){.rp-activity-whale{animation:none}}
`;
var isRecord2 = (value) => !!value && typeof value === "object" && !Array.isArray(value);
var readCollectionValue2 = (value, key) => {
  if (!isRecord2(value) || typeof value.get !== "function")
    return void 0;
  return value.get(key);
};
var activityOf = (value) => isRecord2(value) ? value : null;
function tavernActivityPresentation(activity, now = Date.now()) {
  if (!activity || !activity.running && activity.stage !== "paused")
    return null;
  const phrases = {
    prepare: ["\u5BFC\u6F14\u6B63\u5728\u8D76\u6765\u7684\u8DEF\u4E0A\u2026", "\u573A\u666F\u7EC4\u6B63\u5728\u6446\u653E\u9053\u5177\u2026"],
    story: ["\u5C0F\u9CB8\u9C7C\u6B63\u5728\u75AF\u72C2\u7801\u5B57\u2026", "\u4E0B\u4E00\u5E55\u6B63\u5728\u5192\u51FA\u58A8\u9999\u2026", "\u6545\u4E8B\u7684\u5C0F\u5F15\u64CE\u6B63\u5728\u5F00\u8DB3\u9A6C\u529B\u2026"],
    memory: ["\u5BFC\u6F14\u6B63\u62B1\u7740\u7B14\u8BB0\u8D76\u6765\u2026", "\u6B63\u5728\u628A\u4F0F\u7B14\u6536\u8FDB\u5C0F\u62BD\u5C49\u2026"],
    status: ["\u573A\u8BB0\u6B63\u5728\u6E05\u70B9\u80CC\u5305\u2026", "\u6B63\u5728\u6838\u5BF9\u8FD9\u4E00\u5E55\u7684\u53D8\u5316\u2026"],
    decision: ["\u5C94\u8DEF\u53E3\u7684\u8DEF\u724C\u6B63\u5728\u7ACB\u8D77\u6765\u2026", "\u6B63\u5728\u5BFB\u627E\u4E0B\u4E00\u6B65\u7684\u7075\u611F\u2026"],
    management: ["\u5E55\u540E\u5C0F\u7EC4\u6B63\u5728\u6536\u5C3E\u2026", "\u6545\u4E8B\u6863\u6848\u6B63\u5728\u5F52\u4F4D\u2026"],
    paused: ["\u5E55\u540E\u5DE5\u4F5C\u5DF2\u6682\u505C\uFF0C\u53EF\u5728\u65E5\u5FD7\u4E2D\u67E5\u770B\u539F\u56E0"]
  };
  const labels = {
    prepare: "\u51C6\u5907\u573A\u666F",
    story: "\u6B63\u6587\u751F\u6210",
    memory: "\u8BB0\u5FC6\u66F4\u65B0",
    status: "\u72B6\u6001\u680F\u66F4\u65B0",
    decision: "\u51B3\u7B56\u5EFA\u8BAE",
    management: "\u540E\u53F0\u6574\u7406",
    paused: "\u5DF2\u6682\u505C"
  };
  const elapsed = Math.max(0, Number(activity.elapsedMs) || 0) + (activity.running ? Math.max(0, now - (Number(activity.observedAt) || now)) : 0);
  const stage = String(activity.stage ?? "");
  const choices = phrases[stage] ?? phrases.management ?? [];
  const label = labels[stage] ?? labels.management ?? "";
  return { label, text: choices[Math.floor(elapsed / 8e3) % choices.length] ?? "", seconds: Math.floor(elapsed / 1e3) };
}
var backgroundJobsOf = (activity) => Array.isArray(activity.backgroundJobs) ? activity.backgroundJobs.filter(isRecord2).map((job) => job) : [];
function backgroundNotesPresentation(activity, sessionId, now = Date.now()) {
  if (!sessionId || activity?.sessionId !== sessionId)
    return null;
  const jobs = backgroundJobsOf(activity).filter((job) => job.kind === "memory" && ["queued", "running"].some((status) => status === job.status));
  if (!jobs.length)
    return null;
  const startedAt = Math.min(...jobs.map((job) => Number(job.createdAt)).filter((time) => Number.isFinite(time) && time > 0));
  const stale = now - Number(activity.observedAt ?? 0) > 15e3;
  const running = jobs.some((job) => job.status === "running");
  return {
    label: stale ? "\u6B63\u5728\u91CD\u65B0\u786E\u8BA4\u540E\u53F0\u8FDB\u5EA6" : running ? "\u5BFC\u6F14\u6B63\u5728\u6574\u7406\u7B14\u8BB0" : "\u5BFC\u6F14\u7B14\u8BB0\u5DF2\u8FDB\u5165\u540E\u53F0\u961F\u5217",
    detail: "\u53EF\u7EE7\u7EED\u9605\u8BFB\u548C\u53D1\u9001 \xB7 \u6545\u4E8B\u4E0D\u4F1A\u5728\u8FD9\u91CC\u505C\u4E0B",
    seconds: Number.isFinite(startedAt) ? Math.max(0, Math.floor(((stale ? Number(activity.observedAt) : now) - startedAt) / 1e3)) : null,
    stale,
    running
  };
}
var BACKGROUND_NOTES_CSS = `
.rp-background-notes{position:fixed;z-index:700;top:calc(70px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 28px);box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:12px 18px 13px 12px;border:1px solid color-mix(in srgb,var(--dsw-alias-label-primary,#24334a) 14%,transparent);border-radius:16px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#fffdf8) 95%,transparent);color:var(--dsw-alias-label-primary,#24334a);box-shadow:0 8px 28px #152b481c,0 1px 4px #152b4808;backdrop-filter:blur(14px);pointer-events:none;font:inherit;overflow:hidden}
.rp-background-notes::after{content:'';position:absolute;bottom:0;left:0;width:38%;height:2px;background:linear-gradient(90deg,transparent,#5cc4d0,#3977d6,transparent);animation:rp-notes-ink 3s ease-in-out infinite}
.rp-background-notes[data-stale=true]::after{animation:none;opacity:.35}
.rp-background-notes-icon{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:11px;color:#428baf;background:color-mix(in srgb,#58b7c9 12%,transparent)}
.rp-background-notes strong{display:block;font-size:13px;line-height:1.6;font-weight:600;letter-spacing:.03em}
.rp-background-notes small{display:block;font-size:11px;line-height:1.7;color:var(--dsw-alias-label-caption,#778293)}
.rp-background-notes time{margin-left:12px;padding-left:14px;border-left:1px solid color-mix(in srgb,currentColor 12%,transparent);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--dsw-alias-label-caption,#778293)}
@keyframes rp-notes-ink{0%,100%{transform:translateX(-100%)}65%{transform:translateX(280%)}}
@media(max-width:540px){.rp-background-notes{top:calc(62px + env(safe-area-inset-top,0px));gap:9px;padding:9px 12px 10px 9px;border-radius:13px}.rp-background-notes time{margin-left:0;padding-left:9px}.rp-background-notes small{font-size:10px}}
@media(prefers-reduced-motion:reduce){.rp-background-notes::after{animation:none;width:100%;opacity:.5}}
`;
function createActivityComponents({ React, isRoleplaySession, peekState }) {
  const useTavernActivity = (sessionId, seed = null) => {
    const [activity, setActivity] = React.useState(null);
    const [running, setRunning] = React.useState(false);
    React.useEffect(() => {
      setActivity(null);
      setRunning(false);
    }, [sessionId]);
    React.useEffect(() => {
      if (!sessionId)
        return;
      return startActivityPolling({
        eligible: () => isRoleplaySession(sessionId),
        read: async () => {
          const { response, raw } = await fetchRoleplayText("/api/roleplay/activity?sessionId=" + encodeURIComponent(sessionId), 5e3);
          const data = JSON.parse(raw);
          return response.ok && isRecord2(data) && data.sessionId === sessionId && data.schemaVersion === 1 ? data : null;
        },
        receive: (data) => {
          setRunning(!!(data && data.running));
          if (data)
            setActivity(data);
        },
        // A conversation that is not generating gains nothing from a fast poll,
        // and every attempt is a full round trip that competes with the reader.
        schedule: (fn) => setInterval(fn, running ? 3e3 : 3e4)
      });
    }, [sessionId, running]);
    return activity?.sessionId === sessionId ? activity : seed?.sessionId === sessionId ? seed : null;
  };
  const ActivityBanner = ({ activity }) => {
    const [now, setNow] = React.useState(Date.now());
    React.useEffect(() => {
      if (!activity?.running)
        return;
      const timer = setInterval(() => setNow(Date.now()), 1e3);
      return () => clearInterval(timer);
    }, [activity?.running]);
    const value = tavernActivityPresentation(activity, now);
    return value ? React.createElement("div", { className: "rp-activity", role: "status", "aria-live": "polite" }, React.createElement("span", { className: "rp-activity-whale", "aria-hidden": true }, "\u{1F40B}"), React.createElement("span", null, React.createElement("strong", null, value.text), React.createElement("small", null, value.label)), React.createElement("time", { "aria-hidden": true }, `${value.seconds}s`)) : null;
  };
  const BackgroundNotesBanner = ({ activity, sessionId }) => {
    const [now, setNow] = React.useState(Date.now());
    const active = Boolean(backgroundNotesPresentation(activity, sessionId));
    React.useEffect(() => {
      if (!active)
        return;
      setNow(Date.now());
      const timer = setInterval(() => setNow(Date.now()), 1e3);
      return () => clearInterval(timer);
    }, [active, sessionId]);
    const value = backgroundNotesPresentation(activity, sessionId, now);
    if (!value)
      return null;
    return React.createElement(React.Fragment, null, React.createElement("style", null, BACKGROUND_NOTES_CSS), React.createElement("aside", { className: "rp-background-notes", "data-stale": value.stale, "data-session-id": sessionId, role: "status", "aria-live": "polite" }, React.createElement("span", { className: "rp-background-notes-icon", "aria-hidden": true }, React.createElement("svg", { width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement("path", { d: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M8 8h3M8 12h2M8 16h7m0-8 5-5 2 2-5 5-3 1z" }))), React.createElement("span", null, React.createElement("strong", null, value.label), React.createElement("small", null, value.detail)), value.seconds !== null ? React.createElement("time", { "aria-hidden": true }, `${value.seconds}s`) : null));
  };
  const pendingPlayerBubble = (activity, nodes = [], hasNativePending = false) => {
    const pending = activityOf(activity)?.pendingPlayer;
    const pendingRecord = isRecord2(pending) ? pending : null;
    if (!pendingRecord || hasNativePending || nodes.some((node) => node.kind === "user" && readerMessageId(node) === pendingRecord.messageId))
      return null;
    return React.createElement("div", { className: "rp-pending-player", "data-roleplay-pending-player": pendingRecord.messageId }, React.createElement("div", null, pendingRecord.text || "\u5DF2\u53D1\u9001\u9644\u4EF6"), React.createElement("small", null, activity?.stage === "paused" ? "\u6D88\u606F\u5DF2\u4FDD\u7559 \xB7 \u7B49\u5F85\u7EE7\u7EED" : "\u5DF2\u53D1\u9001 \xB7 \u6B63\u5728\u51C6\u5907\u573A\u666F"));
  };
  function DeferredPlayerInput(props) {
    const activity = useTavernActivity(props.sessionId, peekState(props.sessionId)?.activity);
    const useChat = typeof props.useChat === "function" ? props.useChat : () => null;
    const chat = useChat((state) => state);
    const nodes = chat?.nodes && Array.isArray(chat.order) && isRecord2(chat.nodes) ? chat.order.map((key) => readCollectionValue2(chat.nodes, key)).filter(isRecord2) : [];
    return React.createElement(React.Fragment, null, React.createElement("style", null, ACTIVITY_CSS), pendingPlayerBubble(activity, nodes, props.hasNativePending));
  }
  return { useTavernActivity, ActivityBanner, BackgroundNotesBanner, pendingPlayerBubble, DeferredPlayerInput };
}

// author-panels.js
var errorMessage3 = (error) => error && typeof error === "object" && "message" in error ? error.message : error;
function createAuthorPanels({ React, sessionDrafts, fetchState, invalidateState, saveState, runMaintenance, jsonFetch, toast }) {
  const btn = (label, onClick, extra = {}) => React.createElement("button", {
    type: "button",
    className: "dsh-rp-btn",
    onClick,
    ...extra
  }, label);
  const useRoleplayState = (sessionId, visible) => {
    const [data, setData] = React.useState(null);
    const [error, setError] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [rev, setRev] = React.useState(0);
    const loadedSession = React.useRef(sessionId);
    React.useEffect(() => {
      if (!visible || !sessionId)
        return;
      let alive = true;
      if (loadedSession.current !== sessionId) {
        loadedSession.current = sessionId;
        setData(null);
        setError(null);
      }
      setLoading(true);
      const load = () => {
        fetchState(sessionId, rev > 0).then((d) => {
          if (!alive)
            return;
          if (d?.sessionId !== sessionId) {
            setError("\u4F1A\u8BDD\u6570\u636E\u4E0E\u5F53\u524D\u9009\u62E9\u4E0D\u4E00\u81F4\uFF0C\u8BF7\u91CD\u65B0\u52A0\u8F7D");
            return;
          }
          setData(d);
          setError(d && d.ok ? null : d?.error ?? "\u4F1A\u8BDD\u4E0D\u5B58\u5728\u6216\u975E\u89D2\u8272\u626E\u6F14\u4F1A\u8BDD");
        }).catch((e) => {
          if (alive)
            setError(String(errorMessage3(e)));
        }).finally(() => {
          if (alive)
            setLoading(false);
        });
      };
      load();
      const timer = setInterval(load, 1e4);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [sessionId, visible, rev]);
    const refresh = () => {
      invalidateState(sessionId);
      setRev((r) => r + 1);
    };
    return {
      data: data?.sessionId === sessionId ? data : null,
      error,
      loading,
      refresh
    };
  };
  const PanelShell = ({ title, children, visible, sessionId, error, loading, refresh, extra }) => React.createElement("div", {
    className: "dsh-rp-panel"
  }, React.createElement("div", {
    className: "dsh-rp-row"
  }, React.createElement("h4", {
    style: {
      margin: 0,
      flex: 1
    }
  }, title), extra, btn("\u5237\u65B0", refresh)), loading ? React.createElement("div", {
    className: "dsh-rp-muted",
    role: "status"
  }, "\u52A0\u8F7D\u8BBE\u5B9A\u4E2D\u2026") : null, error ? React.createElement("div", {
    className: "dsh-rp-error",
    role: "alert"
  }, `\u8BBE\u5B9A\u52A0\u8F7D\u5931\u8D25\uFF1A${error}`, React.createElement("button", {
    type: "button",
    className: "dsh-rp-btn",
    onClick: refresh
  }, "\u91CD\u65B0\u52A0\u8F7D")) : null, children);
  function MemorySettingsControls({ sessionId, visible, onSaved, retrievalControls }) {
    const [scope, setScope] = React.useState("session"), [policyValue, setPolicy] = React.useState(null), [values, setValues] = React.useState({}), [error, setError] = React.useState(null), [saving, setSaving] = React.useState(false), [revision, setRevision] = React.useState(0);
    const policy = policyValue;
    const draftKey = `${sessionId}:memory-settings-${scope}`;
    React.useEffect(() => {
      if (!visible || !sessionId)
        return;
      let live = true;
      setPolicy(null);
      setError(null);
      jsonFetch("/api/roleplay/memory-settings?sessionId=" + encodeURIComponent(sessionId)).then((p) => {
        if (!live)
          return;
        setPolicy(p);
        setValues(sessionDrafts.get(draftKey)?.values ?? p[scope].settings);
      }).catch((e) => {
        if (live)
          setError(String(errorMessage3(e)));
      });
      return () => {
        live = false;
      };
    }, [sessionId, scope, visible, revision]);
    const change = (field, value) => {
      const next = {
        ...values,
        [field]: value === "" ? null : Number(value)
      };
      setValues(next);
      sessionDrafts.set(draftKey, {
        values: next,
        expectedRevision: sessionDrafts.get(draftKey)?.expectedRevision ?? policy[scope].revision
      });
    };
    const fields = [
      ["contextWindowTokens", "\u7A97\u53E3\u5927\u5C0F", 1e3],
      ["continuityTailTokens", "\u7A97\u53E3\u5C3E\u90E8\u8FDE\u7EED\u6B63\u6587\u4FDD\u7559\u91CF", 1e3],
      ["autoNotesEveryTurns", "\u540E\u53F0\u7B14\u8BB0\u66F4\u65B0\u9891\u7387", 1]
    ];
    const legacy = [["targetContextTokens", "\u8D85\u51FA\u6A21\u578B\u4E0A\u4E0B\u6587\u524D\u7684\u517C\u5BB9\u6574\u7406\u9608\u503C", 1], ["archiveTokens", "\u6BCF\u6B21\u517C\u5BB9\u5F52\u6863\u91CF", 1]];
    const save = async (reset = false) => {
      if (!policy)
        return;
      const settings = Object.fromEntries([...fields, ...legacy].filter(([f]) => reset || Object.prototype.hasOwnProperty.call(values, f)).map(([f]) => [f, reset ? null : values[f]]));
      for (const [f, , min] of [...fields, ...legacy])
        if (settings[f] != null && (!Number.isSafeInteger(settings[f]) || settings[f] < min)) {
          setError("\u8BF7\u8F93\u5165\u6709\u6548\u6574\u6570\uFF1B\u7559\u7A7A\u8868\u793A\u7EE7\u627F");
          return;
        }
      setSaving(true);
      setError(null);
      try {
        const p = await jsonFetch("/api/roleplay/memory-settings", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            scope,
            settings,
            expectedRevision: sessionDrafts.get(draftKey)?.expectedRevision ?? policy[scope].revision
          })
        });
        sessionDrafts.delete(draftKey);
        setPolicy(p);
        setValues(p[scope].settings);
        onSaved?.();
        toast(scope === "global" ? "\u5168\u5C40\u8BB0\u5FC6\u8BBE\u7F6E\u5DF2\u4FDD\u5B58" : "\u4F1A\u8BDD\u8BB0\u5FC6\u8BBE\u7F6E\u5DF2\u4FDD\u5B58");
      } catch (e) {
        setError(String(errorMessage3(e)));
        toast("\u8BB0\u5FC6\u8BBE\u7F6E\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(errorMessage3(e)));
      } finally {
        setSaving(false);
      }
    };
    const input = ([field, label, min]) => {
      const inherited = scope === "global" ? policy.defaults[field] : policy.global.settings[field] ?? policy.defaults[field];
      return React.createElement("label", {
        key: field,
        className: "dsh-rp-field",
        style: {
          flex: "1 1 200px",
          minWidth: 0
        }
      }, label, React.createElement("input", {
        className: "dsh-rp-input",
        type: "number",
        min,
        step: 1,
        disabled: saving,
        value: values[field] ?? "",
        placeholder: `\u7EE7\u627F\uFF1A${inherited}`,
        onChange: (e) => change(field, e.target.value)
      }), React.createElement("small", {
        className: "dsh-rp-muted"
      }, field === "autoNotesEveryTurns" ? `\u6BCF ${values[field] ?? inherited} \u4E2A\u6B63\u53F2\u5267\u60C5\u8F6E\u6B21\uFF1B\u91CD\u65B0\u751F\u6210\u4E0D\u8BA1\u6570` : `${values[field] ?? inherited} tokens${values[field] == null ? " \xB7 \u7EE7\u627F" : ""}`));
    };
    return React.createElement("section", {
      "data-roleplay-memory-settings": scope
    }, React.createElement("h4", null, "\u7A97\u53E3\u4E0E\u540E\u53F0\u7B14\u8BB0"), React.createElement("div", {
      className: "dsh-rp-row",
      role: "group",
      "aria-label": "\u8BB0\u5FC6\u8BBE\u7F6E\u8303\u56F4"
    }, ["session", "global"].map((s) => React.createElement("button", {
      key: s,
      type: "button",
      className: "dsh-rp-btn" + (scope === s ? " dsh-rp-primary" : ""),
      "aria-pressed": scope === s,
      disabled: saving,
      onClick: () => setScope(s)
    }, s === "session" ? "\u672C\u4F1A\u8BDD" : "\u5168\u5C40\u9ED8\u8BA4"))), React.createElement("p", {
      className: "dsh-rp-muted"
    }, scope === "session" ? "\u7559\u7A7A\u7684\u9879\u76EE\u6CBF\u7528\u5168\u5C40\u8BBE\u7F6E\uFF1B\u4EC5\u5F71\u54CD\u5F53\u524D\u4F1A\u8BDD\u3002" : "\u4F5C\u4E3A\u6240\u6709\u672A\u5355\u72EC\u8986\u76D6\u4F1A\u8BDD\u7684\u9ED8\u8BA4\u8BBE\u7F6E\u3002\u7559\u7A7A\u6062\u590D\u8F6F\u4EF6\u9ED8\u8BA4\u503C\u3002"), error ? React.createElement("div", {
      role: "alert",
      className: "dsh-rp-error"
    }, error, React.createElement("button", {
      className: "dsh-rp-btn",
      onClick: () => setRevision((v) => v + 1)
    }, "\u91CD\u65B0\u52A0\u8F7D")) : null, policy ? React.createElement(React.Fragment, null, React.createElement("div", {
      className: "dsh-rp-row",
      style: {
        alignItems: "flex-start",
        flexWrap: "wrap"
      }
    }, fields.map(input)), React.createElement("p", {
      className: "dsh-rp-muted"
    }, "\u7A97\u53E3\u5373\u5C06\u6DD8\u6C70\u65E7\u6B63\u6587\u65F6\uFF0C\u4F1A\u5148\u786E\u8BA4\u68C0\u67E5\u70B9\u5DF2\u4FDD\u5B58\uFF1B\u540E\u53F0\u6574\u7406\u9891\u7387\u4E0D\u53D6\u6D88\u8FD9\u9053\u4FDD\u5B58\u5173\u53E3\u3002"), retrievalControls, React.createElement("details", null, React.createElement("summary", {
      style: {
        cursor: "pointer",
        padding: "12px 0"
      }
    }, "\u9AD8\u7EA7\u517C\u5BB9\u9009\u9879"), React.createElement("p", {
      className: "dsh-rp-muted"
    }, "\u65E7\u538B\u7F29\u6A21\u5F0F\u7684\u517C\u5BB9\u4FDD\u62A4\u53C2\u6570\uFF0C\u4EC5\u7528\u4E8E\u6A21\u578B\u4E0A\u4E0B\u6587\u538B\u529B\u515C\u5E95\uFF1B\u4E0D\u63A7\u5236\u65E5\u5E38\u786C\u5207\u7A97\u53E3\u548C\u540E\u53F0\u7B14\u8BB0\u9891\u7387\u3002"), React.createElement("div", {
      className: "dsh-rp-row",
      style: {
        flexWrap: "wrap"
      }
    }, legacy.map(input))), React.createElement("div", {
      className: "dsh-rp-row"
    }, React.createElement("button", {
      className: "dsh-rp-btn dsh-rp-primary",
      disabled: saving || !sessionDrafts.has(draftKey),
      onClick: () => save()
    }, saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u8BB0\u5FC6\u8BBE\u7F6E"), React.createElement("button", {
      className: "dsh-rp-btn",
      disabled: saving,
      onClick: () => save(true)
    }, scope === "session" ? "\u6062\u590D\u5168\u5C40\u8BBE\u7F6E" : "\u6062\u590D\u9ED8\u8BA4\u503C"))) : !error ? React.createElement("p", {
      className: "dsh-rp-muted"
    }, "\u6B63\u5728\u8BFB\u53D6\u8BB0\u5FC6\u8BBE\u7F6E\u2026") : null);
  }
  function MemoryPanel(props) {
    const { scope, visible } = props;
    const sessionId = scope?.sessionId;
    const { data, error, refresh } = useRoleplayState(sessionId, visible);
    const [summary, setSummary] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const [organizing, setOrganizing] = React.useState(false);
    const [dirty, setDirty] = React.useState(false);
    const rememberMemory = (patch) => {
      const prior = sessionDrafts.get(`${sessionId}:memory`);
      markPanelDraftFields(sessionDrafts, sessionId, "memory", patch);
      if (!prior?.dirty)
        updatePanelDraft(sessionDrafts, sessionId, "memory", {
          baseVersions: data?.recordVersions
        });
      setDirty(true);
    };
    React.useEffect(() => {
      const draft = sessionDrafts.get(`${sessionId}:memory`);
      if (draft?.dirty && Object.prototype.hasOwnProperty.call(draft, "summary")) {
        setSummary(draft.summary);
        setDirty(true);
      } else {
        setSummary(null);
        setDirty(false);
      }
    }, [sessionId]);
    React.useEffect(() => {
      if (!data || data.sessionId !== sessionId)
        return;
      if (!dirty)
        setSummary(data.directorNotes?.text ?? data.memory?.summary ?? "");
    }, [data, dirty, sessionId]);
    const organize = async () => {
      setOrganizing(true);
      try {
        await runMaintenance(sessionId, "notes");
        setDirty(false);
        refresh();
        toast("\u5BFC\u6F14\u7B14\u8BB0\u5DF2\u4FDD\u5B58");
      } catch (error2) {
        toast("\u8BB0\u5FC6\u6574\u7406\u5931\u8D25\uFF1A" + String(errorMessage3(error2)));
      } finally {
        setOrganizing(false);
      }
    };
    const save = async () => {
      setSaving(true);
      try {
        const draft = sessionDrafts.get(`${sessionId}:memory`), expectedSeq = draft?.fieldSeqs?.summary;
        const updated = await saveState({
          sessionId,
          kind: "memory",
          summary,
          directorNotes: true,
          expectedRevision: draft?.baseVersions?.memory ?? data?.recordVersions?.memory ?? "missing"
        });
        const remaining = settlePanelDraftFields(sessionDrafts, sessionId, "memory", ["summary"], {
          memory: updated.recordVersions.memory
        }, {
          summary: expectedSeq
        });
        setDirty(Boolean(remaining?.dirty));
        toast("\u8BB0\u5FC6\u5DF2\u4FDD\u5B58");
        refresh();
      } catch (e) {
        toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(errorMessage3(e)));
      } finally {
        setSaving(false);
      }
    };
    const facts = data?.memory?.lockedFacts ?? [];
    const deltas = data?.memory?.deltas ?? [];
    return React.createElement(PanelShell, {
      title: "\u8BB0\u5FC6",
      visible,
      sessionId,
      error,
      refresh,
      extra: btn(organizing ? "\u6574\u7406\u4E2D\u2026" : "\u7ACB\u5373\u6574\u7406", organize, {
        disabled: organizing
      })
    }, React.createElement("textarea", {
      className: "dsh-rp-textarea",
      rows: 14,
      style: {
        minHeight: "260px",
        height: "clamp(260px, 45vh, 460px)",
        resize: "vertical"
      },
      value: summary ?? "",
      onChange: (e) => {
        setSummary(e.target.value);
        rememberMemory({
          summary: e.target.value
        });
      },
      placeholder: "\u5C1A\u65E0\u5BFC\u6F14\u7B14\u8BB0"
    }), React.createElement("div", {
      className: "dsh-rp-row"
    }, btn(saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58\u603B\u7ED3", save)), React.createElement("h4", null, "\u9501\u5B9A\u4E8B\u5B9E\uFF08\u538B\u7F29\u65F6\u6C38\u4E0D\u88AB\u6539\u5199\uFF09"), facts.length ? facts.map((f, i) => React.createElement("div", {
      key: i,
      className: "dsh-rp-item"
    }, typeof f === "string" ? f : f.text)) : React.createElement("div", {
      className: "dsh-rp-muted"
    }, "\uFF08\u65E0\uFF1B/memory lock <\u4E8B\u5B9E> \u6216\u89D2\u8272\u5361\u9501\u5B9A\uFF09"), React.createElement(MemorySettingsControls, {
      sessionId,
      visible,
      onSaved: refresh,
      retrievalControls: props.retrievalControls
    }), React.createElement("h4", null, "\u6700\u8FD1\u589E\u91CF\uFF08" + deltas.length + " \u6761\uFF09"), deltas.slice(-12).reverse().map((d, i) => React.createElement("div", {
      key: i,
      className: "dsh-rp-item"
    }, React.createElement("div", {
      className: "dsh-rp-muted"
    }, "seq " + d.evidenceSeq + " \xB7 " + (d.status ?? "")), d.summary)));
  }
  function WorldbookPanel(props) {
    const { scope, visible } = props;
    const sessionId = scope?.sessionId;
    const { data, error, refresh } = useRoleplayState(sessionId, visible);
    const [editing, setEditing] = React.useState(null);
    const [formValue, setFormState] = React.useState(null);
    const form = formValue;
    const [saving, setSaving] = React.useState(false);
    const setForm = (next) => {
      setFormState(next);
      const prior = sessionDrafts.get(sessionId + ":worldbook");
      updatePanelDraft(sessionDrafts, sessionId, "worldbook", {
        form: next,
        dirty: true,
        baseVersion: prior?.dirty ? prior.baseVersion : data?.recordVersions?.worldbook?.[next?.id] ?? "missing"
      });
    };
    const rememberForm = setForm;
    React.useEffect(() => {
      const draft = sessionDrafts.get(`${sessionId}:worldbook`);
      if (draft?.dirty && draft.form) {
        setFormState(draft.form);
        setEditing(draft.form);
      }
    }, [sessionId]);
    const entries = data?.worldbook ?? [];
    const startEdit = (entry) => {
      rememberForm(entry === "new" ? {
        id: "",
        name: "",
        kind: "place",
        content: "",
        keywords: "",
        priority: 0,
        token_budget: 400,
        always_on: false,
        locked: false
      } : {
        id: entry.id,
        name: entry.name,
        kind: entry.kind,
        content: entry.content,
        keywords: (entry.keywords ?? []).join("\u3001"),
        priority: entry.priority ?? 0,
        token_budget: entry.tokenBudget ?? 400,
        always_on: entry.alwaysOn === true,
        locked: entry.locked === true
      });
      setEditing(entry);
    };
    const save = async () => {
      setSaving(true);
      const draftAtSubmit = sessionDrafts.get(sessionId + ":worldbook");
      try {
        await saveState({
          sessionId,
          kind: "worldbook",
          id: String(form.id).trim(),
          name: form.name,
          entry_kind: form.kind,
          content: form.content,
          keywords: String(form.keywords ?? "").split(/[、,\s]+/).filter(Boolean),
          priority: Number(form.priority) || 0,
          token_budget: Number(form.token_budget) || 400,
          always_on: form.always_on === true,
          locked: form.locked === true,
          expectedRevision: draftAtSubmit?.baseVersion ?? data?.recordVersions?.worldbook?.[form.id] ?? "missing"
        });
        toast("\u4E16\u754C\u4E66\u6761\u76EE\u5DF2\u4FDD\u5B58");
        if (sessionDrafts.get(sessionId + ":worldbook") === draftAtSubmit)
          sessionDrafts.delete(sessionId + ":worldbook");
        setEditing(null);
        refresh();
      } catch (e) {
        toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(errorMessage3(e)));
      } finally {
        setSaving(false);
      }
    };
    const remove = async (id) => {
      try {
        await saveState({
          sessionId,
          kind: "worldbook-delete",
          id
        });
        toast("\u5DF2\u5220\u9664");
        refresh();
      } catch (e) {
        toast("\u5220\u9664\u5931\u8D25\uFF1A" + String(errorMessage3(e)));
      }
    };
    const field = (label, value, onChange, type = "text") => React.createElement("label", {
      className: "dsh-rp-row"
    }, React.createElement("span", {
      className: "dsh-rp-muted",
      style: {
        width: "64px"
      }
    }, label), React.createElement("input", {
      className: "dsh-rp-input",
      type,
      value: value ?? "",
      onChange: (e) => onChange(e.target.value)
    }));
    return React.createElement(PanelShell, {
      title: "\u4E16\u754C\u4E66",
      visible,
      sessionId,
      error,
      refresh,
      extra: btn("\uFF0B \u65B0\u589E", () => startEdit("new"), {
        disabled: saving
      })
    }, editing ? React.createElement("fieldset", {
      disabled: saving,
      style: {
        border: 0,
        padding: 0,
        margin: 0
      }
    }, React.createElement("div", {
      className: "dsh-rp-item"
    }, field("id", form.id, (v) => rememberForm({
      ...form,
      id: v
    })), field("\u540D\u79F0", form.name, (v) => rememberForm({
      ...form,
      name: v
    })), field("\u7C7B\u578B", form.kind, (v) => rememberForm({
      ...form,
      kind: v
    })), field("\u5173\u952E\u8BCD", form.keywords, (v) => rememberForm({
      ...form,
      keywords: v
    })), React.createElement("textarea", {
      className: "dsh-rp-textarea",
      value: form.content ?? "",
      onChange: (e) => rememberForm({
        ...form,
        content: e.target.value
      }),
      placeholder: "\u6761\u76EE\u5185\u5BB9\uFF08\u89E6\u53D1\u65F6\u4EE5\u9690\u85CF\u4E0A\u4E0B\u6587\u6CE8\u5165\uFF09"
    }), React.createElement("div", {
      className: "dsh-rp-row"
    }, field("\u4F18\u5148\u7EA7", form.priority, (v) => rememberForm({
      ...form,
      priority: v
    }), "number"), field("token\u9884\u7B97", form.token_budget, (v) => rememberForm({
      ...form,
      token_budget: v
    }), "number"), React.createElement("label", null, React.createElement("input", {
      type: "checkbox",
      checked: form.always_on === true,
      onChange: (e) => rememberForm({
        ...form,
        always_on: e.target.checked
      })
    }), "\u65E7\u5361\u5E38\u9A7B\u517C\u5BB9\uFF08\u5EFA\u8BAE\u6574\u7406\u5230\u6838\u5FC3\u8BBE\u5B9A\uFF09"), React.createElement("span", {
      className: "dsh-rp-muted"
    }, "\u65B0\u80CC\u666F\u8D44\u6599\u653E\u6838\u5FC3\u8BBE\u5B9A\uFF1B\u666E\u901A\u4E16\u754C\u4E66\u6309\u67E5\u8BE2\u8BFB\u53D6\u3002"), React.createElement("label", null, React.createElement("input", {
      type: "checkbox",
      checked: form.locked === true,
      onChange: (e) => rememberForm({
        ...form,
        locked: e.target.checked
      })
    }), "\u9501\u5B9A")), React.createElement("div", {
      className: "dsh-rp-row"
    }, btn(saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58", save), btn("\u53D6\u6D88", () => {
      sessionDrafts.delete(sessionId + ":worldbook");
      setEditing(null);
    })))) : entries.length ? entries.map((e) => React.createElement("div", {
      key: e.id,
      className: "dsh-rp-item"
    }, React.createElement("div", {
      className: "dsh-rp-item-head"
    }, React.createElement("span", {
      className: "dsh-rp-item-title"
    }, e.name + (e.locked ? " \u{1F512}" : "")), React.createElement("span", {
      className: "dsh-rp-muted"
    }, e.kind + " \xB7 \u4F18\u5148\u7EA7" + e.priority + (e.alwaysOn ? " \xB7 \u5E38\u9A7B" : ""))), React.createElement("div", {
      className: "dsh-rp-muted",
      style: {
        margin: "2px 0"
      }
    }, String(e.content ?? "").slice(0, 120)), React.createElement("div", {
      className: "dsh-rp-row"
    }, btn("\u7F16\u8F91", () => startEdit(e)), btn("\u5220\u9664", () => remove(e.id))))) : React.createElement("div", {
      className: "dsh-rp-muted"
    }, "\uFF08\u6682\u65E0\u6761\u76EE\uFF1B\u70B9\u51FB\u300C\uFF0B \u65B0\u589E\u300D\u6216\u8BA9 AI \u7528 rp_worldbook_add \u5199\u5165\uFF09"));
  }
  function CardsPanel(props) {
    const { scope, visible } = props;
    const sessionId = scope?.sessionId;
    const { data, error, refresh } = useRoleplayState(sessionId, visible);
    const [editing, setEditing] = React.useState(null);
    const [formValue, setFormState] = React.useState(null);
    const form = formValue;
    const [saving, setSaving] = React.useState(false);
    const setForm = (next) => {
      setFormState(next);
      const prior = sessionDrafts.get(sessionId + ":cards");
      updatePanelDraft(sessionDrafts, sessionId, "cards", {
        form: next,
        dirty: true,
        baseVersion: prior?.dirty ? prior.baseVersion : data?.recordVersions?.cards?.[next?.card_id] ?? "missing"
      });
    };
    const rememberForm = setForm;
    React.useEffect(() => {
      const draft = sessionDrafts.get(`${sessionId}:cards`);
      if (draft?.dirty && draft.form) {
        setFormState(draft.form);
        setEditing(draft.form);
      }
    }, [sessionId]);
    const cards = data?.cards ?? [];
    const startEdit = (card) => {
      rememberForm(card === "new" ? {
        card_id: "",
        name: "",
        kind: "npc",
        content: "",
        locked: false
      } : {
        card_id: card.id,
        name: card.name,
        kind: card.kind,
        content: card.content,
        locked: card.locked === true
      });
      setEditing(card);
    };
    const save = async () => {
      setSaving(true);
      const draftAtSubmit = sessionDrafts.get(sessionId + ":cards");
      try {
        await saveState({
          sessionId,
          kind: "card",
          card_id: String(form.card_id).trim(),
          name: form.name,
          card_kind: form.kind,
          content: form.content,
          locked: form.locked === true,
          expectedRevision: draftAtSubmit?.baseVersion ?? data?.recordVersions?.cards?.[form.card_id] ?? "missing"
        });
        toast("\u4EBA\u7269\u8BBE\u5B9A\u5DF2\u4FDD\u5B58");
        if (sessionDrafts.get(sessionId + ":cards") === draftAtSubmit)
          sessionDrafts.delete(sessionId + ":cards");
        setEditing(null);
        refresh();
      } catch (e) {
        toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(errorMessage3(e)));
      } finally {
        setSaving(false);
      }
    };
    const field = (label, value, onChange) => React.createElement("label", {
      className: "dsh-rp-row"
    }, React.createElement("span", {
      className: "dsh-rp-muted",
      style: {
        width: "64px"
      }
    }, label), React.createElement("input", {
      className: "dsh-rp-input",
      value: value ?? "",
      onChange: (e) => onChange(e.target.value)
    }));
    return React.createElement(PanelShell, {
      title: "\u4EBA\u7269\u8BBE\u5B9A",
      visible,
      sessionId,
      error,
      refresh,
      extra: btn("\uFF0B \u65B0\u589E\u4EBA\u7269", () => startEdit("new"), {
        disabled: saving
      })
    }, editing ? React.createElement("fieldset", {
      disabled: saving,
      style: {
        border: 0,
        padding: 0,
        margin: 0
      }
    }, React.createElement("div", {
      className: "dsh-rp-item"
    }, field("card_id", form.card_id, (v) => rememberForm({
      ...form,
      card_id: v
    })), field("\u540D\u79F0", form.name, (v) => rememberForm({
      ...form,
      name: v
    })), React.createElement("label", {
      className: "dsh-rp-row"
    }, React.createElement("span", {
      className: "dsh-rp-muted",
      style: {
        width: "64px"
      }
    }, "\u7C7B\u578B"), React.createElement("select", {
      className: "dsh-rp-input",
      value: form.kind,
      onChange: (e) => rememberForm({
        ...form,
        kind: e.target.value
      })
    }, React.createElement("option", {
      value: "user"
    }, "user\uFF08\u73A9\u5BB6\u89D2\u8272\uFF09"), React.createElement("option", {
      value: "npc"
    }, "npc"), React.createElement("option", {
      value: "other"
    }, "other"))), React.createElement("textarea", {
      className: "dsh-rp-textarea",
      value: form.content ?? "",
      onChange: (e) => rememberForm({
        ...form,
        content: e.target.value
      }),
      placeholder: "\u4EBA\u8BBE\u6B63\u6587\uFF08\u6027\u683C/\u53E3\u543B/\u52A8\u673A/\u79D8\u5BC6/\u5916\u8C8C/\u80FD\u529B/\u4EF7\u503C\u5E95\u7EBF\uFF09"
    }), React.createElement("label", null, React.createElement("input", {
      type: "checkbox",
      checked: form.locked === true,
      onChange: (e) => rememberForm({
        ...form,
        locked: e.target.checked
      })
    }), " \u9501\u5B9A\u4E8B\u5B9E\uFF08\u538B\u7F29\u65F6\u6C38\u4E0D\u88AB\u6539\u5199\uFF09"), React.createElement("div", {
      className: "dsh-rp-row"
    }, btn(saving ? "\u4FDD\u5B58\u4E2D\u2026" : "\u4FDD\u5B58", save), btn("\u53D6\u6D88", () => {
      sessionDrafts.delete(sessionId + ":cards");
      setEditing(null);
    })))) : cards.length ? cards.map((c) => React.createElement("div", {
      key: c.id,
      className: "dsh-rp-item"
    }, React.createElement("div", {
      className: "dsh-rp-item-head"
    }, React.createElement("span", {
      className: "dsh-rp-item-title"
    }, c.name + (c.locked ? " \u{1F512}" : "")), React.createElement("span", {
      className: "dsh-rp-muted"
    }, c.kind + " \xB7 v" + c.version)), React.createElement("div", {
      className: "dsh-rp-muted",
      style: {
        margin: "2px 0"
      }
    }, String(c.content ?? "").slice(0, 120)), React.createElement("div", {
      className: "dsh-rp-row"
    }, btn("\u7F16\u8F91", () => startEdit(c))))) : React.createElement("div", {
      className: "dsh-rp-muted"
    }, "\uFF08\u6682\u65E0\u4EBA\u7269\u8BBE\u5B9A\uFF1B\u70B9\u51FB\u300C\uFF0B \u65B0\u589E\u4EBA\u7269\u300D\u6216\u8BA9 AI \u7528 rp_card_set \u5199\u5165\uFF09"));
  }
  function RuleSlicePanel({ scope, visible, field, title, guidance, rows }) {
    const sessionId = scope?.sessionId;
    const { data, error, loading, refresh } = useRoleplayState(sessionId, visible);
    const [value, setValue] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const remember = (next) => {
      const prior = sessionDrafts.get(`${sessionId}:settings`);
      markPanelDraftFields(sessionDrafts, sessionId, "settings", {
        [field]: next
      });
      if (!prior?.dirty)
        updatePanelDraft(sessionDrafts, sessionId, "settings", {
          baseVersions: data?.recordVersions
        });
    };
    React.useEffect(() => {
      setValue(null);
      setSaving(false);
    }, [sessionId, field]);
    React.useEffect(() => {
      const draft = sessionDrafts.get(`${sessionId}:settings`);
      if (draft?.dirty && draft[field] !== void 0)
        setValue(draft[field]);
    }, [sessionId, field]);
    React.useEffect(() => {
      const draft = sessionDrafts.get(`${sessionId}:settings`);
      if (data && value === null)
        setValue(draft?.[field] ?? data.rules?.[field === "styleKw" ? "style" : field] ?? "");
    }, [data, value, sessionId, field]);
    const save = async () => {
      if (saving)
        return;
      const draft = sessionDrafts.get(`${sessionId}:settings`);
      const rules = data?.rules ?? {};
      const body = buildRulesSaveBody(field, value, rules);
      setSaving(true);
      try {
        const updated = await saveState({
          sessionId,
          ...body,
          expectedRevision: draft?.baseVersions?.rules ?? data?.recordVersions?.rules ?? "missing"
        });
        settlePanelDraftFields(sessionDrafts, sessionId, "settings", [field], {
          rules: updated.recordVersions.rules
        }, {
          [field]: draft?.fieldSeqs?.[field]
        });
        toast(`${title}\u5DF2\u4FDD\u5B58`);
        refresh();
      } catch (e) {
        toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(errorMessage3(e)));
      } finally {
        setSaving(false);
      }
    };
    const legacyEntries = field === "core" ? data?.worldbook?.filter((entry) => entry.enabled !== false && entry.alwaysOn === true) ?? [] : [];
    return React.createElement(PanelShell, {
      title,
      visible,
      sessionId,
      error,
      loading,
      refresh
    }, React.createElement("p", null, guidance), React.createElement("textarea", {
      className: "dsh-rp-textarea",
      style: {
        minHeight: `${rows * 20}px`
      },
      value: value ?? "",
      disabled: loading || !data,
      onChange: (e) => {
        setValue(e.target.value);
        remember(e.target.value);
      }
    }), legacyEntries.length ? React.createElement("details", null, React.createElement("summary", null, `\u6838\u5FC3\u8BBE\u5B9A\xB7\u65E7\u5361\u5E38\u9A7B\u6807\u8BB0\u517C\u5BB9\u6295\u5F71\uFF08${legacyEntries.length}\uFF09`), React.createElement("p", {
      className: "dsh-rp-muted"
    }, "\u539F\u4EF6\u672A\u6539\u5199\u3001\u53EF\u5728\u4E16\u754C\u4E66\u7BA1\u7406\u65E7\u8BB0\u5F55\u3002\u4EE5\u4E0B\u4E3A\u53EA\u8BFB\u5168\u6587\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u8FC1\u79FB\u3001\u5220\u9664\u6216\u4FEE\u6539\u6570\u636E\u3002"), legacyEntries.map((entry) => React.createElement("div", {
      key: entry.id,
      className: "dsh-rp-item"
    }, React.createElement("div", {
      className: "dsh-rp-item-title"
    }, entry.name || entry.id || "\u672A\u547D\u540D\u6761\u76EE"), React.createElement("pre", {
      style: {
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        margin: "8px 0 0"
      }
    }, String(entry.content ?? ""))))) : null, React.createElement("div", {
      className: "dsh-rp-row"
    }, btn(`\u4FDD\u5B58${title}`, save, {
      disabled: saving || loading || !data
    })));
  }
  function CoreRulesPanel(props) {
    return React.createElement(RuleSlicePanel, {
      ...props,
      field: "core",
      title: "\u6838\u5FC3\u8BBE\u5B9A",
      rows: 10,
      guidance: "\u4E16\u754C\u57FA\u7840\u3001\u6838\u5FC3\u5A01\u80C1\u3001\u957F\u671F\u77DB\u76FE\uFF1B\u8FD9\u4E9B\u5185\u5BB9\u5E38\u9A7B\u4E14\u4E0D\u53C2\u4E0E\u5267\u60C5\u538B\u7F29\u3002"
    });
  }
  function PlotGuidancePanel(props) {
    return React.createElement(RuleSlicePanel, {
      ...props,
      field: "plot",
      title: "\u5267\u60C5\u6307\u5F15",
      rows: 10,
      guidance: "\u8DEF\u7EBF/\u6761\u4EF6/\u53EF\u80FD\u7ED3\u5C40\u662F\u672A\u53D1\u751F\u7684\u4F5C\u8005\u6307\u5F15\uFF0C\u4E0D\u662F\u5F53\u524D\u5267\u60C5\u4E8B\u5B9E\u3002"
    });
  }
  function StyleSpecializationPanel(props) {
    return React.createElement(RuleSlicePanel, {
      ...props,
      field: "styleKw",
      title: "\u6587\u98CE\u7279\u5316",
      rows: 10,
      guidance: "\u5B8C\u6574\u4FDD\u7559\u98CE\u683C\u8981\u6C42\u548C\u5199\u4F5C\u793A\u4F8B\uFF0C\u793A\u4F8B\u4E0D\u89C6\u4F5C\u5F53\u524D\u5267\u60C5\u3002"
    });
  }
  function SettingsPanel(props) {
    const { scope, visible } = props;
    const sessionId = scope?.sessionId;
    const { data, error, refresh } = useRoleplayState(sessionId, visible);
    const [statusText, setStatusText] = React.useState(null);
    const [core, setCore] = React.useState(null);
    const [plot, setPlot] = React.useState(null);
    const [narrative, setNarrative] = React.useState(null);
    const [reply, setReply] = React.useState(null);
    const [styleKw, setStyleKw] = React.useState(null);
    const [opening, setOpening] = React.useState(null);
    const [beautyCss, setBeautyCss] = React.useState(null);
    const [beautyJs, setBeautyJs] = React.useState(null);
    const [beautyRules, setBeautyRules] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const rememberSettings = (patch) => {
      const prior = sessionDrafts.get(`${sessionId}:settings`);
      const next = markPanelDraftFields(sessionDrafts, sessionId, "settings", patch);
      if (!prior?.dirty)
        updatePanelDraft(sessionDrafts, sessionId, "settings", {
          baseVersions: data?.recordVersions
        });
      return next;
    };
    React.useEffect(() => {
      const draft = sessionDrafts.get(`${sessionId}:settings`);
      if (!draft?.dirty)
        return;
      for (const [key, setter] of [
        ["statusText", setStatusText],
        ["core", setCore],
        ["plot", setPlot],
        ["narrative", setNarrative],
        ["reply", setReply],
        ["styleKw", setStyleKw],
        ["opening", setOpening],
        ["beautyCss", setBeautyCss],
        ["beautyJs", setBeautyJs],
        ["beautyRules", setBeautyRules]
      ])
        if (draft[key] !== void 0)
          setter(draft[key]);
    }, [sessionId]);
    React.useEffect(() => {
      if (!data)
        return;
      if (!sessionDrafts.get(`${sessionId}:settings`)?.dirty) {
        setStatusText(data.statusSpec?.text ?? "");
        setCore(data.rules?.core ?? "");
        setPlot(data.rules?.plot ?? "");
        setNarrative(data.rules?.narrative ?? "");
        setReply(data.rules?.reply ?? "");
        setStyleKw(data.rules?.style ?? "");
        setOpening(data.opening?.text ?? "");
        setBeautyCss(data.rules?.beauty?.css ?? "");
        setBeautyJs(data.rules?.beauty?.js ?? "");
      }
      if (statusText === null)
        setStatusText(data.statusSpec?.text ?? "");
      if (core === null)
        setCore(data.rules?.core ?? "");
      if (plot === null)
        setPlot(data.rules?.plot ?? "");
      if (narrative === null)
        setNarrative(data.rules?.narrative ?? "");
      if (reply === null)
        setReply(data.rules?.reply ?? "");
      if (styleKw === null)
        setStyleKw(data.rules?.style ?? "");
      if (opening === null)
        setOpening(data.opening?.text ?? "");
      if (beautyCss === null)
        setBeautyCss(data.rules?.beauty?.css ?? "");
      if (beautyJs === null)
        setBeautyJs(data.rules?.beauty?.js ?? "");
      if (beautyRules === null) {
        const rr = Array.isArray(data.rules?.beauty?.regexRules) ? data.rules.beauty.regexRules : [];
        setBeautyRules(rr.length ? JSON.stringify(rr, null, 2) : '[\n  { "match": "\u3010\u5FC3\u7406\u3011([\\\\s\\\\S]+?)\u3010/\u5FC3\u7406\u3011", "replace": "<span class=\\"rp-thought\\">$1</span>" }\n]');
      }
    }, [data]);
    const save = async (body, msg) => {
      setSaving(true);
      try {
        const draft = sessionDrafts.get(`${sessionId}:settings`);
        const fields = body.kind === "status" ? ["statusText"] : body.kind === "opening" ? ["opening"] : body.beauty ? [
          "beautyRules",
          "beautyCss",
          "beautyJs"
        ] : [
          ...body.core !== void 0 ? ["core"] : [],
          ...body.plot !== void 0 ? ["plot"] : [],
          ...body.narrative !== void 0 ? ["narrative"] : [],
          ...body.reply !== void 0 ? ["reply"] : [],
          ...body.style !== void 0 ? ["styleKw"] : []
        ];
        const expectedSeqs = Object.fromEntries(fields.map((field) => [field, draft?.fieldSeqs?.[field]]));
        const updated = await saveState({
          sessionId,
          ...body,
          expectedRevision: draft?.baseVersions?.[body.kind] ?? body.expectedRevision ?? "missing"
        });
        settlePanelDraftFields(sessionDrafts, sessionId, "settings", fields, {
          [body.kind]: updated.recordVersions[body.kind]
        }, expectedSeqs);
        toast(msg);
        refresh();
      } catch (e) {
        toast("\u4FDD\u5B58\u5931\u8D25\uFF1A" + String(errorMessage3(e)));
      } finally {
        setSaving(false);
      }
    };
    const ta = (value, onChange, rows = 6) => React.createElement("textarea", {
      className: "dsh-rp-textarea",
      style: {
        minHeight: rows * 20 + "px"
      },
      value: value ?? "",
      onChange: (e) => onChange(e.target.value)
    });
    return React.createElement(PanelShell, {
      title: "\u81EA\u5B9A\u4E49\u89C4\u5219",
      visible,
      sessionId,
      error,
      refresh
    }, React.createElement("h4", null, "\u72B6\u6001\u680F\u8BBE\u5B9A\uFF08\u6B63\u6587\u540E\u751F\u6210\u72B6\u6001\u680F\u7684\u683C\u5F0F\uFF09"), ta(statusText, (value) => {
      setStatusText(value);
      rememberSettings({
        statusText: value
      });
    }, 8), React.createElement("div", {
      className: "dsh-rp-row"
    }, btn(saving ? "\u2026" : "\u4FDD\u5B58\u72B6\u6001\u680F", () => save({
      kind: "status",
      text: statusText,
      expectedRevision: data?.recordVersions?.status ?? null
    }, "\u72B6\u6001\u680F\u5DF2\u4FDD\u5B58"))), React.createElement("h4", null, "\u53D9\u4E8B\u89C4\u5219"), ta(narrative, (value) => {
      setNarrative(value);
      rememberSettings({
        narrative: value
      });
    }, 5), React.createElement("h4", null, "\u56DE\u590D\u89C4\u5219"), ta(reply, (value) => {
      setReply(value);
      rememberSettings({
        reply: value
      });
    }, 5), React.createElement("div", {
      className: "dsh-rp-row"
    }, btn(saving ? "\u2026" : "\u4FDD\u5B58\u89C4\u5219", () => save({
      ...buildCustomRulesSaveBody(narrative, reply),
      expectedRevision: data?.recordVersions?.rules ?? null
    }, "\u89C4\u5219\u5DF2\u4FDD\u5B58"), {
      disabled: saving
    })), React.createElement("h4", null, "\u521D\u59CB\u5267\u60C5\uFF08\u4EC5\u6545\u4E8B\u5F00\u59CB\u65F6\u6CE8\u5165\u4E00\u6B21\uFF09"), ta(opening, (value) => {
      setOpening(value);
      rememberSettings({
        opening: value
      });
    }, 8), React.createElement("div", {
      className: "dsh-rp-row"
    }, btn(saving ? "\u2026" : "\u4FDD\u5B58\u5F00\u573A", () => save({
      kind: "opening",
      text: opening,
      expectedRevision: data?.recordVersions?.opening ?? null
    }, "\u5F00\u573A\u5DF2\u4FDD\u5B58"))), React.createElement("h4", null, "\u6392\u7248\u7F8E\u5316 \xB7 \u6B63\u5219\u89C4\u5219\uFF08\u9605\u8BFB\u89C6\u56FE\u6B63\u6587\u7279\u6548\uFF1BJSON \u6570\u7EC4 [{match, replace}]\uFF09"), React.createElement("p", null, "\u5148\u5339\u914D\u539F\u6587\uFF1B\u672A\u547D\u4E2D\u65F6\u5339\u914D Markdown \u6E32\u67D3\u540E\u7684 HTML\u3002\u4E2D\u6587\u53CC\u5F15\u53F7\u89C4\u5219\u4E5F\u517C\u5BB9\u6B63\u6587\u4E2D\u7684\u6210\u5BF9\u76F4\u5F15\u53F7\uFF0C\u4E0D\u6539\u5199\u5267\u60C5\u8BB0\u5F55\u3002"), ta(beautyRules, (value) => {
      setBeautyRules(value);
      rememberSettings({
        beautyRules: value
      });
    }, 8), React.createElement("h4", null, "\u6392\u7248\u7F8E\u5316 \xB7 CSS\uFF08\u9009\u62E9\u5668\u81EA\u52A8\u52A0 .rp-reader-view \u4F5C\u7528\u57DF\uFF1B\u53EF\u8986\u76D6\u9ED8\u8BA4\u5976\u6CB9\u7EB8\u611F\u4E3B\u9898\uFF09"), ta(beautyCss, (value) => {
      setBeautyCss(value);
      rememberSettings({
        beautyCss: value
      });
    }, 10), React.createElement("h4", null, "\u6392\u7248\u7F8E\u5316 \xB7 JS\uFF08\u6E32\u67D3\u540E\u6267\u884C\uFF1B\u6C99\u7BB1\u53C2\u6570 root=\u9605\u8BFB\u5BB9\u5668, fill=\u586B\u5165\u8F93\u5165\u6846\uFF09"), ta(beautyJs, (value) => {
      setBeautyJs(value);
      rememberSettings({
        beautyJs: value
      });
    }, 6), React.createElement("div", {
      className: "dsh-rp-row"
    }, btn(saving ? "\u2026" : "\u4FDD\u5B58\u6392\u7248\u7F8E\u5316", () => {
      let rr;
      try {
        rr = JSON.parse(beautyRules ?? "[]");
      } catch {
        toast("\u6B63\u5219\u89C4\u5219\u4E0D\u662F\u5408\u6CD5 JSON");
        return;
      }
      if (!Array.isArray(rr)) {
        toast("\u6B63\u5219\u89C4\u5219\u5FC5\u987B\u662F\u6570\u7EC4");
        return;
      }
      save({
        kind: "rules",
        beauty: {
          regexRules: rr,
          css: beautyCss ?? "",
          js: beautyJs ?? ""
        },
        expectedRevision: data?.recordVersions?.rules ?? null
      }, "\u6392\u7248\u7F8E\u5316\u5DF2\u4FDD\u5B58");
    })));
  }
  return {
    btn,
    PanelShell,
    MemoryPanel,
    WorldbookPanel,
    CardsPanel,
    CoreRulesPanel,
    PlotGuidancePanel,
    StyleSpecializationPanel,
    SettingsPanel
  };
}

// memory-retrieval-panel.js
var bytes = (n) => n == null ? "\u2014" : `${(n / 1024 ** 2).toFixed(1)} MiB`;
var protocols = {
  "openai": "OpenAI \u5B98\u65B9 / \u517C\u5BB9\u63A5\u53E3",
  "dashscope-text": "\u963F\u91CC\u4E91 DashScope \u6587\u672C",
  "dashscope-multimodal": "\u963F\u91CC\u4E91 DashScope \u591A\u6A21\u6001"
};
var hostname = (baseUrl) => {
  if (!baseUrl)
    return "\u672A\u586B\u5199\u5730\u5740";
  try {
    return new URL(baseUrl).hostname || "\u672A\u586B\u5199\u5730\u5740";
  } catch {
    return "\u5730\u5740\u683C\u5F0F\u5F85\u68C0\u67E5";
  }
};
var geminiEmbeddingModels = /* @__PURE__ */ new Set(["gemini-embedding-2", "gemini-embedding-2-preview"]);
var MEMORY_RETRIEVAL_CSS = `
.dsh-rp-retrieval{display:grid;gap:14px;margin:12px 0}
.dsh-rp-retrieval-card{display:grid;gap:12px;padding:16px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff)}
.dsh-rp-retrieval-card h5,.dsh-rp-retrieval-card p{margin:0}
.dsh-rp-retrieval-grid,.dsh-rp-provider-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px}
.dsh-rp-retrieval-field{display:grid;gap:5px;min-width:0}
.dsh-rp-retrieval-field input,.dsh-rp-retrieval-field select{width:100%;min-width:0;box-sizing:border-box;padding:8px}
.dsh-rp-provider-choice{text-align:left;display:grid;gap:6px;padding:12px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:10px;background:transparent;color:inherit;cursor:pointer}
.dsh-rp-provider-selected{outline:2px solid var(--dsw-alias-brand-primary,#3375db);outline-offset:1px}
.dsh-rp-provider-badge{display:inline-block;font-size:11px;border-radius:99px;padding:2px 7px;background:rgba(51,117,219,.12);margin-right:5px}
.dsh-rp-model-picker{display:flex;gap:6px;align-items:center}.dsh-rp-model-picker select{flex:1;width:0}.dsh-rp-model-picker button{flex:0 0 auto}
.dsh-rp-progress{display:grid;gap:7px}.dsh-rp-progress-bar{height:7px;overflow:hidden;border-radius:99px;background:rgba(100,120,145,.18)}
.dsh-rp-progress-bar>span{display:block;height:100%;background:var(--dsw-alias-brand-primary,#3375db)}
.dsh-rp-stale-confirm{width:min(460px,calc(100vw - 32px));margin:auto;padding:18px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:14px;color:var(--dsw-alias-label-primary,#413a3d);background:var(--dsw-alias-bg-layer-1,#fffaf6);box-shadow:0 20px 70px rgba(0,0,0,.35)}
.dsh-rp-stale-confirm::backdrop{background:rgba(0,0,0,.34);backdrop-filter:blur(2px)}
.dsh-rp-stale-confirm h6,.dsh-rp-stale-confirm p{margin:0}.dsh-rp-stale-confirm h6{font-size:16px}.dsh-rp-stale-confirm .dsh-rp-row{justify-content:flex-end;margin-top:16px}
`;
function createMemoryRetrievalPanel({ React, jsonFetch, toast }) {
  const h = React.createElement;
  const field = (label, node) => h("label", {
    className: "dsh-rp-retrieval-field"
  }, label, node);
  const note = (value) => h("p", {
    className: "dsh-rp-muted"
  }, value);
  const badge = (value) => h("span", {
    className: "dsh-rp-provider-badge",
    key: value
  }, value);
  function RetrievalPanel({ sessionId, view }) {
    const [data, setData] = React.useState(null);
    const [draft, setDraft] = React.useState({});
    const [dirty, setDirty] = React.useState(false), [busy, setBusy] = React.useState(null);
    const [error, setError] = React.useState(null), [modeScope, setModeScope] = React.useState("session");
    const [chunkDraft, setChunkDraft] = React.useState(""), [chunkDirty, setChunkDirty] = React.useState(false);
    const [modelLists, setModelLists] = React.useState({});
    const [sessions, setSessions] = React.useState([]);
    const [progressSession, setProgressSession] = React.useState(sessionId);
    const [progressReply, setProgressReply] = React.useState(null);
    const [progressError, setProgressError] = React.useState(null);
    const [indexConfirmation, setIndexConfirmation] = React.useState(null);
    const [staleConfirmation, setStaleConfirmation] = React.useState(null);
    const staleDialogRef = React.useRef(null), stalePreviousFocusRef = React.useRef(null);
    const chunkDirtyRef = React.useRef(false);
    const requestRef = React.useRef(0), sessionRef = React.useRef(sessionId), dirtyRef = React.useRef(false), busyRef = React.useRef(false), editRef = React.useRef(0);
    sessionRef.current = sessionId;
    const load = React.useCallback(async () => {
      if (busyRef.current)
        return;
      const request = ++requestRef.current;
      try {
        const next = await jsonFetch(`/api/roleplay/memory-retrieval?sessionId=${encodeURIComponent(sessionId)}`);
        if (request !== requestRef.current || sessionRef.current !== sessionId)
          return;
        if (next.ok === false)
          throw Error(next.error ?? "\u8BFB\u53D6\u5931\u8D25");
        setData(next);
        setError(null);
        if (next.activeProviderId)
          setModelLists((old) => ({
            ...old,
            [next.activeProviderId]: next.modelList
          }));
        if (!dirtyRef.current)
          setDraft((previous) => ({
            ...next.providers.find((p) => p.id === previous.id) ?? next.providers.find((p) => p.id === next.activeProviderId) ?? next.providers[0]
          }));
        if (!chunkDirtyRef.current)
          setChunkDraft(String(next.chunkChars ?? 480));
      } catch (e) {
        if (request === requestRef.current && sessionRef.current === sessionId)
          setError(String(e));
      }
    }, [sessionId, jsonFetch]);
    React.useEffect(() => {
      setData(null);
      setDraft({});
      setDirty(false);
      setBusy(null);
      setError(null);
      setModelLists({});
      setSessions([]);
      setChunkDraft("");
      setChunkDirty(false);
      dirtyRef.current = false;
      chunkDirtyRef.current = false;
      busyRef.current = false;
      setProgressSession(sessionId);
      setProgressReply(null);
      setModeScope("session");
      setIndexConfirmation(null);
      setStaleConfirmation(null);
      void load();
      return () => {
        requestRef.current++;
      };
    }, [sessionId]);
    React.useEffect(() => {
      setIndexConfirmation(null);
    }, [sessionId, data?.revision, data?.activeProviderId, draft.id, progressSession]);
    React.useEffect(() => {
      if (!staleConfirmation)
        return;
      if (staleConfirmation.sessionId !== sessionId || staleConfirmation.providerId !== data?.activeProviderId || staleConfirmation.revision !== data?.revision || staleConfirmation.fingerprint !== (data?.progress.fingerprint ?? "")) {
        setStaleConfirmation(null);
      }
    }, [sessionId, data?.revision, data?.activeProviderId, data?.progress.fingerprint, staleConfirmation]);
    React.useLayoutEffect(() => {
      const dialog = staleDialogRef.current;
      if (!staleConfirmation || !dialog)
        return;
      stalePreviousFocusRef.current = typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null;
      try {
        if (!dialog.matches?.(":modal"))
          dialog.showModal?.();
      } catch {
        dialog.setAttribute("open", "");
      }
      const cancel = dialog.querySelector?.("[data-dsh-rp-stale-cancel]");
      cancel?.focus();
      return () => {
        if (dialog.open)
          dialog.close?.();
        const previous = stalePreviousFocusRef.current;
        stalePreviousFocusRef.current = null;
        previous?.focus?.();
      };
    }, [staleConfirmation]);
    React.useEffect(() => {
      const timer = window.setInterval(() => void load(), busy ? 3e3 : 2e4);
      return () => window.clearInterval(timer);
    }, [load, busy]);
    React.useEffect(() => {
      if (view !== "embedding")
        return;
      let alive = true;
      void jsonFetch(`/api/roleplay/usage-requests?sessionId=${encodeURIComponent(sessionId)}&scope=all&limit=1`).then((reply) => {
        if (alive)
          setSessions(reply.sessions ?? []);
      }).catch(() => {
      });
      return () => {
        alive = false;
      };
    }, [sessionId, view]);
    React.useEffect(() => {
      if (view !== "embedding" || progressSession === sessionId)
        return;
      let alive = true;
      void jsonFetch(`/api/roleplay/memory-retrieval?sessionId=${encodeURIComponent(progressSession)}`).then((reply) => {
        if (!alive)
          return;
        if (reply.ok === false)
          throw Error(reply.error ?? "\u65E0\u6CD5\u8BFB\u53D6\u8FDB\u5EA6");
        setProgressReply({
          id: progressSession,
          data: reply
        });
        setProgressError(null);
      }).catch((e) => {
        if (alive) {
          setProgressReply(null);
          setProgressError(String(e));
        }
      });
      return () => {
        alive = false;
      };
    }, [sessionId, progressSession, data, view]);
    const update = (patch) => {
      editRef.current++;
      dirtyRef.current = true;
      setDirty(true);
      setDraft((old) => ({
        ...old,
        ...patch
      }));
    };
    const action = async (name, extra = {}) => {
      if (!data || busyRef.current)
        return;
      const request = ++requestRef.current, edit = editRef.current;
      busyRef.current = true;
      setBusy(name);
      setError(null);
      try {
        const next = await jsonFetch("/api/roleplay/memory-retrieval", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            expectedRevision: data.revision,
            action: name,
            ...extra
          })
        });
        if (request !== requestRef.current || sessionRef.current !== sessionId)
          return;
        if (next.ok === false)
          throw Error(next.error ?? "\u64CD\u4F5C\u5931\u8D25");
        setData(next);
        if (name === "index-chunk-size") {
          chunkDirtyRef.current = false;
          setChunkDirty(false);
          setChunkDraft(String(next.chunkChars ?? extra.chunkChars ?? 480));
        }
        if (name === "refresh-models")
          setModelLists((old) => ({
            ...old,
            [String(extra.providerId)]: next.modelList
          }));
        if (name === "save-provider" && editRef.current === edit) {
          const saved2 = next.providers.find((p) => p.id === draft.id) ?? next.providers.find((p) => !data.providers.some((old) => old.id === p.id));
          setDraft({
            ...saved2,
            apiKey: ""
          });
          dirtyRef.current = false;
          setDirty(false);
          if (saved2)
            setModelLists((old) => {
              const copy2 = {
                ...old
              };
              delete copy2[saved2.id];
              return copy2;
            });
          toast("\u63A5\u5165\u5DF2\u4FDD\u5B58\uFF0C\u8BF7\u6D4B\u8BD5\u540E\u542F\u7528");
        } else if (!dirtyRef.current && editRef.current === edit) {
          setDraft({
            ...next.providers.find((p) => p.id === draft.id) ?? next.providers.find((p) => p.id === next.activeProviderId) ?? next.providers[0]
          });
        }
      } catch (e) {
        if (request === requestRef.current && sessionRef.current === sessionId) {
          setError(String(e));
          toast(`\u8BB0\u5FC6\u68C0\u7D22\u64CD\u4F5C\u5931\u8D25\uFF1A${String(e)}`);
        }
      } finally {
        if (request === requestRef.current && sessionRef.current === sessionId) {
          busyRef.current = false;
          setBusy(null);
        }
      }
    };
    const button = (label, onClick, disabled = false, primary = false) => h("button", {
      type: "button",
      className: "dsh-rp-btn" + (primary ? " dsh-rp-primary" : ""),
      onClick,
      disabled: !data || busy !== null || disabled
    }, label);
    const activeProvider = data?.activeProviderId ? data.providers.find((provider) => provider.id === data.activeProviderId) : void 0;
    const clearStaleConfirmation = () => {
      setStaleConfirmation(null);
    };
    const requestIndex = (enabled) => {
      if (enabled && data?.progress.stale === true) {
        const providerId = data.activeProviderId, fingerprint = data.progress.fingerprint ?? "";
        if (providerId) {
          setStaleConfirmation({
            sessionId,
            providerId,
            revision: data.revision,
            fingerprint
          });
          return;
        }
      }
      void action("index", {
        enabled
      });
    };
    const confirmStaleRebuild = () => {
      const target = staleConfirmation;
      if (!target || !data || target.sessionId !== sessionId || target.providerId !== data.activeProviderId || target.revision !== data.revision || target.fingerprint !== (data.progress.fingerprint ?? "")) {
        clearStaleConfirmation();
        return;
      }
      setStaleConfirmation(null);
      void action("rebuild-index", {
        confirmProviderId: target.providerId
      });
    };
    const closeStaleDialog = (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearStaleConfirmation();
    };
    const trapStaleDialogFocus = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        clearStaleConfirmation();
        return;
      }
      if (event.key !== "Tab")
        return;
      const dialog = staleDialogRef.current;
      if (!dialog)
        return;
      const focusable = Array.from(dialog.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length)
        return;
      const current = focusable.indexOf(document.activeElement);
      const next = (current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      event.preventDefault();
      focusable[next]?.focus();
    };
    const staleConfirmCard = staleConfirmation ? h("dialog", {
      ref: staleDialogRef,
      className: "dsh-rp-stale-confirm",
      "role": "alertdialog",
      "aria-modal": "true",
      "aria-labelledby": "dsh-rp-stale-confirm-title",
      onCancel: closeStaleDialog,
      onKeyDown: trapStaleDialogFocus
    }, h("h6", {
      id: "dsh-rp-stale-confirm-title"
    }, "\u8BED\u4E49\u7D22\u5F15\u914D\u7F6E\u5DF2\u53D8\u5316"), note(`\u76EE\u6807\u6A21\u578B\uFF1A${activeProvider?.name ?? staleConfirmation.providerId}`), note("\u8303\u56F4\uFF1A\u4EC5\u5F53\u524D\u5BF9\u8BDD\u53CA\u5176\u5168\u90E8\u4E16\u754C\u7EBF\u3002\u65E7\u5411\u91CF\u4F1A\u6E05\u7A7A\u5E76\u6309\u5F53\u524D\u6A21\u578B\u91CD\u5EFA\uFF1B\u5267\u60C5\u6B63\u6587\u3001\u6765\u6E90\u548C\u8D26\u672C\u4FDD\u7559\u4E0D\u53D8\u3002"), note("\u5728\u7EBF\u6A21\u578B\u53EF\u80FD\u4EA7\u751F API \u6D88\u8017\uFF1B\u786E\u8BA4\u540E\u4F1A\u5F00\u542F\u5F53\u524D\u5BF9\u8BDD\u81EA\u52A8\u66F4\u65B0\u3002"), note(`\u76EE\u6807\u7248\u672C\u6307\u7EB9\uFF1A${staleConfirmation.fingerprint.length > 20 ? `${staleConfirmation.fingerprint.slice(0, 20)}\u2026` : staleConfirmation.fingerprint || "\u672A\u63D0\u4F9B"}`), h("div", {
      className: "dsh-rp-row"
    }, h("button", {
      type: "button",
      className: "dsh-rp-btn",
      onClick: clearStaleConfirmation,
      disabled: busy !== null,
      "data-dsh-rp-stale-cancel": true
    }, "\u53D6\u6D88"), h("button", {
      type: "button",
      className: "dsh-rp-btn dsh-rp-primary",
      onClick: confirmStaleRebuild,
      disabled: busy !== null
    }, "\u786E\u8BA4\u91CD\u5EFA\u5E76\u5F00\u542F"))) : null;
    const modeCard = h("div", {
      className: "dsh-rp-retrieval-card"
    }, h("h5", null, "\u8BB0\u5FC6\u68C0\u7D22\u65B9\u5F0F"), note("\u53EA\u68C0\u7D22\u5F53\u524D\u4E16\u754C\u7EBF\u7684\u73A9\u5BB6\u8F93\u5165\u548C\u6709\u6548\u5267\u60C5\u6B63\u6587\uFF0C\u5305\u542B\u5F52\u6863\u65E7\u6B63\u6587\u3002\u5411\u91CF\u6A21\u578B\u9700\u5728\u300CEmbedding \u6A21\u578B\u8BBE\u7F6E\u300D\u4E2D\u624B\u52A8\u914D\u7F6E\u542F\u7528\u3002"), field("\u5C06\u6240\u9009\u65B9\u5F0F\u5E94\u7528\u5230 / Apply to", h("select", {
      value: modeScope,
      onChange: (e) => setModeScope(e.target.value)
    }, h("option", {
      value: "session"
    }, "\u5F53\u524D\u4F1A\u8BDD / Session"), h("option", {
      value: "global"
    }, "\u5168\u5C40\u9ED8\u8BA4 / Global default"))), h("div", {
      className: "dsh-rp-row"
    }, ["keyword", "semantic", "hybrid"].map((mode, i) => h("button", {
      key: mode,
      type: "button",
      className: "dsh-rp-btn" + (data?.mode === mode ? " dsh-rp-primary" : ""),
      "aria-pressed": data?.mode === mode,
      disabled: !data || busy !== null,
      onClick: () => void action("mode", {
        mode,
        scope: modeScope
      })
    }, [
      "A \u5173\u952E\u8BCD / Keyword",
      "B \u8BED\u4E49 / Semantic",
      "C \u6DF7\u5408 / Hybrid"
    ][i]))), note(`\u9009\u62E9\u8303\u56F4\uFF0C\u518D\u70B9\u51FB\u68C0\u7D22\u65B9\u5F0F\u4FDD\u5B58\u3002\u5F53\u524D\u6709\u6548\u8BBE\u7F6E${data?.scope === "global" ? "\u6CBF\u7528\u5168\u5C40\u9ED8\u8BA4" : "\u6765\u81EA\u672C\u4F1A\u8BDD"}\u3002\u5207\u6362\u68C0\u7D22\u65B9\u5F0F\u4E0D\u4F1A\u5220\u9664\u5DF2\u6709\u7D22\u5F15\u3002`), h("label", {
      className: "dsh-rp-row"
    }, h("input", {
      type: "checkbox",
      checked: data?.indexEnabled === true,
      disabled: !data || busy !== null,
      onChange: (e) => requestIndex(e.target.checked)
    }), "\u81EA\u52A8\u66F4\u65B0\u8BED\u4E49\u7D22\u5F15 / Auto-update semantic index"), h("label", {
      className: "dsh-rp-row"
    }, h("input", {
      type: "checkbox",
      checked: data?.autoIndexNewConversations === true,
      disabled: !data || busy !== null || !data.autoIndexNewConversations && !activeProvider?.ready,
      onChange: (e) => void action("auto-index-new-conversations", {
        enabled: e.target.checked
      })
    }), "\u65B0\u5BF9\u8BDD\u81EA\u52A8\u5F00\u542F\u8BED\u4E49\u7D22\u5F15 / Auto-enable semantic indexing for new conversations"), h("label", {
      className: "dsh-rp-row"
    }, h("input", {
      type: "checkbox",
      checked: data?.autoRebuildLocalOnRetrieval === true,
      disabled: !data || busy !== null,
      onChange: (e) => void action("auto-rebuild-local-on-retrieval", {
        enabled: e.target.checked
      })
    }), "\u5BF9\u8BDD\u6D3B\u8DC3\u65F6\uFF0C\u6A21\u578B\u914D\u7F6E\u53D8\u5316\u65F6\u81EA\u52A8\u91CD\u5EFA\uFF08\u4EC5\u672C\u5730\u6A21\u578B\uFF09"), note("\u81EA\u52A8\u66F4\u65B0\u4EC5\u4F5C\u7528\u4E8E\u5F53\u524D\u53EF\u89C1\u5BF9\u8BDD\u53CA\u5176\u5168\u90E8\u4E16\u754C\u7EBF\uFF0C\u4E3A\u5386\u53F2\u548C\u65B0\u589E\u7684\u73A9\u5BB6\u8F93\u5165\u3001\u6709\u6548\u6B63\u6587\u5EFA\u7ACB\u7D22\u5F15\uFF0C\u4E0D\u7B49\u5F85\u5BFC\u6F14\u7B14\u8BB0\u3002\u5173\u95ED\u540E\u4ECD\u53EF\u67E5\u8BE2\u5DF2\u6709\u5411\u91CF\uFF0C\u4F46\u65B0\u5267\u60C5\u4E0D\u4F1A\u52A0\u5165\uFF1B\u5173\u952E\u8BCD\u68C0\u7D22\u7167\u5E38\u5DE5\u4F5C\u3002"), note("\u65B0\u5BF9\u8BDD\u9009\u9879\u662F\u5168\u5C40\u9ED8\u8BA4\uFF0C\u4EC5\u5BF9\u4E4B\u540E\u65B0\u5EFA\u7684\u73A9\u5BB6\u5BF9\u8BDD\u751F\u6548\uFF0C\u8981\u6C42\u5F53\u524D\u5DF2\u542F\u7528\u6A21\u578B\u53EF\u7528\uFF1B\u65E7\u5BF9\u8BDD\u548C\u540E\u53F0\u5B50\u4EE3\u7406\u4E0D\u4F1A\u6279\u91CF\u5F00\u542F\u3002\u5173\u95ED\u6B64\u9ED8\u8BA4\u4E0D\u6539\u53D8\u5DF2\u6709\u5BF9\u8BDD\u7684\u7D22\u5F15\u5F00\u5173\uFF0C\u4E5F\u4E0D\u6539\u53D8\u68C0\u7D22\u6A21\u5F0F\u3002"), note("\u4EC5\u5F53\u524D\u5BF9\u8BDD\u5728\u8BED\u4E49\uFF0F\u6DF7\u5408\u68C0\u7D22\u53D1\u73B0\u6A21\u578B\u6307\u7EB9\u4E0D\u5339\u914D\u65F6\u540E\u53F0\u91CD\u5EFA\uFF1B\u672C\u8F6E\u5148\u7528\u5173\u952E\u8BCD\u3002\u4E0D\u6279\u91CF\u5904\u7406\u5176\u4ED6\u5BF9\u8BDD\uFF0C\u4E0D\u81EA\u52A8\u91CD\u5EFA\u5728\u7EBF\u6A21\u578B\uFF1B\u5173\u95ED\u5F53\u524D\u5BF9\u8BDD\u81EA\u52A8\u7D22\u5F15\u65F6\u4E0D\u4F1A\u81EA\u52A8\u6062\u590D\u3002"), note("\u4F7F\u7528\u8BED\u4E49\uFF0F\u6DF7\u5408\u68C0\u7D22\u65F6\uFF0C\u67E5\u8BE2\u8BCD\u672C\u8EAB\u4ECD\u53EF\u80FD\u8C03\u7528\u5411\u91CF\u6A21\u578B\u3002\u5173\u95ED\u81EA\u52A8\u66F4\u65B0\u4E0D\u7B49\u4E8E\u505C\u6B62\u6240\u6709 API \u6D88\u8017\u3002"), staleConfirmCard);
    const local = draft.kind === "local", saved = data?.providers.find((p) => p.id === draft.id), models = draft.id ? modelLists[draft.id] : void 0;
    const chunkValue = chunkDraft || String(data?.chunkChars ?? 480), chunkNumber = Number(chunkValue), chunkValid = Number.isInteger(chunkNumber) && chunkNumber >= 128 && chunkNumber <= 2048;
    const saveChunkSize = () => {
      if (chunkValid && !busyRef.current)
        void action("index-chunk-size", {
          chunkChars: chunkNumber
        });
    };
    const ids = [...new Set([draft.model, ...models?.ids ?? []].filter((id) => !!id))];
    const modelSelect = local ? h("select", {
      "aria-label": "\u6A21\u578B ID",
      value: draft.model ?? "",
      onChange: (e) => update({
        model: e.target.value,
        dimensions: null
      })
    }, h("option", {
      value: ""
    }, "\u9009\u62E9\u5DF2\u5B89\u88C5\u6A21\u578B"), data?.catalog.filter((m) => m.status === "installed").map((m) => h("option", {
      key: m.id,
      value: m.id
    }, m.name))) : h("div", {
      className: "dsh-rp-model-picker"
    }, h("select", {
      "aria-label": "\u6A21\u578B ID \u4E0B\u62C9\u9009\u62E9",
      value: draft.model ?? "",
      onChange: (e) => update({
        model: e.target.value
      })
    }, h("option", {
      value: ""
    }, "\u9009\u62E9\u6A21\u578B\uFF0C\u6216\u5728\u4E0B\u65B9\u624B\u52A8\u8F93\u5165"), ids.map((id) => h("option", {
      key: id,
      value: id
    }, id))), h("button", {
      type: "button",
      className: "dsh-rp-btn",
      title: "\u5237\u65B0\u6A21\u578B\u5217\u8868",
      "aria-label": "\u5237\u65B0\u6A21\u578B\u5217\u8868",
      disabled: !draft.id || dirty || busy !== null,
      onClick: () => void action("refresh-models", {
        providerId: draft.id
      })
    }, "\u21BB"));
    const providerCard = h("div", {
      className: "dsh-rp-retrieval-card"
    }, h("h5", null, "Embedding \u6A21\u578B\u4E0E\u4F9B\u5E94\u5546"), note("\u672C\u5730\u6A21\u578B\u63A8\u8350\u987A\u5E8F\u4E0E\u5B9E\u6D4B\u9650\u5236\u89C1\u4E0B\u65B9\u300C\u672C\u5730\u6A21\u578B\u4E0B\u8F7D\u300D\u8BF4\u660E\u3002"), h("div", {
      className: "dsh-rp-provider-list"
    }, data?.providers.map((p) => h("button", {
      type: "button",
      key: p.id,
      className: "dsh-rp-provider-choice" + (draft.id === p.id ? " dsh-rp-provider-selected" : ""),
      "aria-pressed": draft.id === p.id,
      disabled: busy !== null,
      onClick: () => {
        editRef.current++;
        dirtyRef.current = false;
        setDirty(false);
        setDraft({
          ...p,
          apiKey: ""
        });
      }
    }, h("strong", null, p.name), h("div", null, badge(p.kind === "local" ? "\u672C\u5730" : "\u5728\u7EBF"), p.kind === "online" ? badge(protocols[p.protocol]) : null, p.kind === "online" && geminiEmbeddingModels.has(p.model ?? "") ? badge("Gemini \u68C0\u7D22\u683C\u5F0F") : null, draft.id === p.id ? badge("\u6B63\u5728\u7F16\u8F91") : null, p.id === data.activeProviderId ? badge("\u5267\u60C5\u8BB0\u5FC6\u4F7F\u7528\u4E2D") : null, p.id === data.adaptationProviderId ? badge("\u5C0F\u8BF4\u7814\u7A76\u4F7F\u7528\u4E2D") : null), h("small", null, p.kind === "online" ? `${p.model ?? "\u672A\u9009\u62E9\u6A21\u578B"} \xB7 ${hostname(p.baseUrl)} \xB7 ${p.ready ? "\u6D4B\u8BD5\u901A\u8FC7" : "\u5F85\u6D4B\u8BD5"} \xB7 ${p.keySet ? "\u5DF2\u4FDD\u5B58 Key" : "\u5C1A\u672A\u914D\u7F6E Key"}` : `${p.model ?? "\u672A\u9009\u62E9\u6A21\u578B"} \xB7 ${p.ready ? "\u6D4B\u8BD5\u901A\u8FC7" : "\u5F85\u6D4B\u8BD5"}`), p.error ? h("small", {
      className: "dsh-rp-error"
    }, p.error) : null))), button("\u65B0\u589E\u63A5\u5165 / New provider", () => {
      editRef.current++;
      dirtyRef.current = true;
      setDirty(true);
      setDraft({
        kind: "online",
        protocol: "openai",
        dimensions: null,
        apiKey: ""
      });
    }), note(draft.id ? `\u6B63\u5728\u7F16\u8F91\uFF1A${draft.name ?? "\u672A\u547D\u540D"}${dirty ? "\uFF08\u6709\u672A\u4FDD\u5B58\u4FEE\u6539\uFF09" : ""}` : "\u63A5\u5165\u76EE\u5F55\u7531\u4E24\u79CD\u7528\u9014\u5171\u4EAB\uFF1B\u6B64\u5904\u9009\u62E9\u5267\u60C5\u8BB0\u5FC6\u6A21\u578B\uFF0C\u5C0F\u8BF4\u7814\u7A76\u6A21\u578B\u5728\u957F\u6587\u672C\u8F6C\u89D2\u8272\u5361\u4E2D\u5355\u72EC\u9009\u62E9\u3002"), h("div", {
      className: "dsh-rp-retrieval-grid"
    }, field("\u540D\u79F0", h("input", {
      value: draft.name ?? "",
      onChange: (e) => update({
        name: e.target.value
      }),
      placeholder: "My embedding provider"
    })), field("\u7C7B\u578B", h("select", {
      value: draft.kind ?? "online",
      onChange: (e) => update({
        kind: e.target.value,
        model: "",
        dimensions: null,
        apiKey: "",
        baseUrl: "",
        protocol: "openai"
      })
    }, h("option", {
      value: "online"
    }, "\u5728\u7EBF / Online"), h("option", {
      value: "local"
    }, "\u672C\u5730 / Local"))), !local ? field("\u534F\u8BAE", h("select", {
      value: draft.protocol ?? "openai",
      onChange: (e) => update({
        protocol: e.target.value
      })
    }, Object.entries(protocols).map(([id, label]) => h("option", {
      key: id,
      value: id
    }, label)))) : null, !local ? field("Base URL", h("input", {
      value: draft.baseUrl ?? "",
      onChange: (e) => update({
        baseUrl: e.target.value
      }),
      placeholder: "https://\u2026"
    })) : null, field("\u6A21\u578B ID", modelSelect), local ? field("\u672C\u5730\u7F16\u7801\u9884\u7B97\uFF08tokens\uFF09", h("input", {
      type: "number",
      min: 64,
      max: data?.catalog.find((m) => m.id === draft.model)?.maxInputTokens ?? 512,
      step: 1,
      value: draft.localMaxTokens ?? 512,
      onChange: (e) => update({
        localMaxTokens: Number(e.target.value)
      })
    })) : null, !local ? field("\u624B\u52A8\u8F93\u5165\u6A21\u578B ID", h("input", {
      value: draft.model ?? "",
      onChange: (e) => update({
        model: e.target.value
      }),
      placeholder: "\u652F\u6301\u81EA\u5B9A\u4E49\u522B\u540D"
    })) : null, !local ? field("\u7EF4\u5EA6\uFF08\u7559\u7A7A\u4F7F\u7528\u6A21\u578B\u9ED8\u8BA4\u503C\uFF09", h("input", {
      type: "number",
      min: 1,
      max: 8192,
      value: draft.dimensions ?? "",
      onChange: (e) => update({
        dimensions: e.target.value ? Number(e.target.value) : null
      })
    })) : null, !local ? field("\u6A21\u578B\u4FEE\u8BA2\u7248\u672C\uFF08\u53EF\u9009\uFF09", h("input", {
      value: draft.embeddingRevision ?? "",
      onChange: (e) => update({
        embeddingRevision: e.target.value
      }),
      placeholder: "\u4F8B\u5982 2026-09-14"
    })) : null, !local ? field("API Key\uFF08\u7559\u7A7A\u4FDD\u7559\u5DF2\u4FDD\u5B58 Key\uFF0C\u4E0D\u56DE\u663E\uFF09", h("input", {
      type: "password",
      autoComplete: "off",
      value: draft.apiKey ?? "",
      onChange: (e) => update({
        apiKey: e.target.value
      })
    })) : null), !local ? note("\u670D\u52A1\u672A\u63D0\u4F9B\u56FA\u5B9A\u7248\u672C\u65F6\u53EF\u81EA\u884C\u6807\u8BB0\uFF1B\u6A21\u578B\u5347\u7EA7\u540E\u4FEE\u6539\u6B64\u503C\u5E76\u91CD\u5EFA\u7D22\u5F15\u3002") : null, local ? note(`\u9ED8\u8BA4 512 tokens\uFF0C\u9002\u5408 4 \u6838 8G \u7684\u4FDD\u5B88\u9884\u7B97\uFF1B\u6240\u9009\u6A21\u578B\u8F93\u5165\u4E0A\u9650 ${data?.catalog.find((m) => m.id === draft.model)?.maxInputTokens ?? "\u2014"} tokens\u3002\u5305\u542B Query\uFF0FDocument \u524D\u7F00\u53CA\u7279\u6B8A token\uFF0C\u7531\u6A21\u578B tokenizer \u5B9E\u9645\u68C0\u67E5\u3002\u5F3A\u786C\u4EF6\u53EF\u8C03\u9AD8\uFF1B\u5185\u5B58\u4FDD\u62A4\u4ECD\u6709\u6548\uFF0C\u8F83\u5927\u9884\u7B97\u53EF\u80FD\u5931\u8D25\uFF0C\u8D85\u957F\u67E5\u8BE2\u4F1A\u56DE\u9000\u5173\u952E\u8BCD\u3002\u4FDD\u5B58\u5E76\u6D4B\u8BD5\u540E\uFF0C\u65E7\u7D22\u5F15\u9700\u6309\u65B0\u6307\u7EB9\u91CD\u5EFA\u3002`) : null, !local && draft.protocol === "openai" && !geminiEmbeddingModels.has(draft.model ?? "") ? note("OpenAI \u5B98\u65B9 Base URL\uFF1Ahttps://api.openai.com/v1\uFF1B\u63A8\u8350\u6A21\u578B\uFF1Atext-embedding-3-small \u6216 text-embedding-3-large\u3002\u4E5F\u652F\u6301\u4E2D\u8F6C\u7AD9\uFF0C\u8BF7\u6309\u4F9B\u5E94\u5546\u63D0\u4F9B\u7684\u5730\u5740\u586B\u5199\uFF0C\u7A0B\u5E8F\u4F1A\u8FFD\u52A0 /embeddings\uFF1B\u201COpenAI \u5B98\u65B9 / \u517C\u5BB9\u63A5\u53E3\u201D\u8868\u793A\u534F\u8BAE\uFF0C\u4E0D\u4EE3\u8868\u5F53\u524D\u914D\u7F6E\u4E00\u5B9A\u8FDE\u63A5 OpenAI \u5B98\u65B9\u3002") : null, !local && draft.protocol === "openai" && geminiEmbeddingModels.has(draft.model ?? "") ? h("div", {
      className: "dsh-rp-retrieval-card"
    }, h("strong", null, "Gemini 2 \u68C0\u7D22\u914D\u7F6E"), note("\u901A\u8FC7 OpenAI \u517C\u5BB9\u63A5\u53E3\u63A5\u5165\uFF1B\u7A0B\u5E8F\u4F1A\u81EA\u52A8\u5339\u914D\u67E5\u8BE2\u4E0E\u6B63\u6587\u89D2\u8272\uFF0C\u65E0\u9700\u624B\u5199 task_type\u3002\u5411\u91CF\u7EDF\u4E00\u8FDB\u884C L2 \u5F52\u4E00\u5316\uFF1B\u7EF4\u5EA6\u9ED8\u8BA4 3072\uFF0C\u4E5F\u53EF\u586B\u5199 768\u30011536 \u6216 3072\u3002\u65E7\u539F\u6587\u7D22\u5F15\u9700\u91CD\u5EFA\u540E\u624D\u4F1A\u4F7F\u7528\u65B0\u7684\u68C0\u7D22\u683C\u5F0F\u3002")) : null, saved?.actualDimensions ? note(`\u5B9E\u9645\u5411\u91CF\u7EF4\u5EA6\uFF1A${saved.actualDimensions}`) : null, !local && models?.error ? h("p", {
      className: "dsh-rp-error"
    }, `${models.error}\uFF1B\u4ECD\u53EF\u624B\u52A8\u8F93\u5165\u6A21\u578B ID\u3002`) : null, h("div", {
      className: "dsh-rp-row"
    }, button("\u4FDD\u5B58\u4F9B\u5E94\u5546", () => void action("save-provider", {
      provider: draft
    }), !dirty, true), button("\u6D4B\u8BD5", () => void action("test-provider", {
      providerId: draft.id
    }), dirty || !draft.id), button("\u7528\u4E8E\u5267\u60C5\u8BB0\u5FC6", () => void action("activate-provider", {
      providerId: draft.id
    }), dirty || !saved?.ready), button("\u5220\u9664\u63A5\u5165", () => void action("delete-provider", {
      providerId: draft.id
    }), !draft.id)));
    const progressData = progressSession === sessionId ? data : progressReply?.id === progressSession ? progressReply.data : null;
    const progress2 = progressData?.progress, covered = progress2?.sources ? Math.min(100, Math.round(progress2.covered / progress2.sources * 100)) : 0;
    const indexActionButton = (label, actionName) => h("button", {
      type: "button",
      className: "dsh-rp-btn",
      disabled: !data || busy !== null || actionName === "rebuild-index" && !activeProvider?.ready,
      onClick: () => setIndexConfirmation(actionName)
    }, label);
    const confirmation = indexConfirmation && data ? h("div", {
      className: "dsh-rp-index-confirm",
      "role": "alertdialog",
      "aria-label": "\u786E\u8BA4\u5411\u91CF\u6570\u636E\u5E93\u64CD\u4F5C"
    }, h("strong", null, indexConfirmation === "rebuild-index" ? "\u786E\u8BA4\u91CD\u5EFA\u5411\u91CF\u6570\u636E\u5E93\uFF1F" : "\u786E\u8BA4\u6E05\u7A7A\u5411\u91CF\u6570\u636E\u5E93\uFF1F"), note(`\u76EE\u6807\u4F9B\u5E94\u5546\uFF1A${activeProvider?.name ?? "\u5F53\u524D\u672A\u542F\u7528\u4F9B\u5E94\u5546"}\uFF1B\u8303\u56F4\uFF1A\u5F53\u524D\u53EF\u89C1\u5BF9\u8BDD\u7684\u5168\u90E8\u6A21\u578B\u5411\u91CF\u7D22\u5F15\uFF08\u5305\u542B\u65E7\u7248\u9057\u7559\u7D22\u5F15\uFF0C\u8986\u76D6\u5176\u6240\u6709\u4E16\u754C\u7EBF\uFF09\u3002`), note(indexConfirmation === "rebuild-index" ? "\u5C06\u6E05\u7A7A\u5F53\u524D\u5BF9\u8BDD\u5168\u90E8\u5411\u91CF\u540E\uFF0C\u4EC5\u4E3A\u5F53\u524D\u542F\u7528\u6A21\u578B\u91CD\u65B0\u7D22\u5F15\uFF1B\u5207\u6362\u5176\u4ED6\u6A21\u578B\u540E\u9700\u91CD\u65B0\u7D22\u5F15\u3002" : "\u5C06\u6E05\u7A7A\u5F53\u524D\u5BF9\u8BDD\u5168\u90E8\u5411\u91CF\u5E76\u6682\u505C\u81EA\u52A8\u66F4\u65B0\uFF1B\u6B63\u6587\u4E0E\u5173\u952E\u8BCD\u8BB0\u5F55\u4FDD\u7559\u3002\u65E7\u5728\u9014\u6A21\u578B\u8BF7\u6C42\u65E0\u6CD5\u64A4\u56DE\uFF0C\u5176\u7ED3\u679C\u4F1A\u4E22\u5F03\uFF0C\u4F46\u53EF\u80FD\u5DF2\u7ECF\u4EA7\u751F API \u6D88\u8017\uFF1B\u67E5\u8BE2\u8BCD\u4ECD\u53EF\u80FD\u4EA7\u751F API \u6D88\u8017\u3002"), h("div", {
      className: "dsh-rp-row"
    }, h("button", {
      type: "button",
      className: "dsh-rp-btn dsh-rp-primary",
      disabled: busy !== null,
      onClick: () => {
        void action(indexConfirmation, {
          confirmProviderId: data.activeProviderId ?? null
        });
        setIndexConfirmation(null);
      }
    }, "\u786E\u8BA4"), h("button", {
      type: "button",
      className: "dsh-rp-btn",
      disabled: busy !== null,
      onClick: () => setIndexConfirmation(null)
    }, "\u53D6\u6D88"))) : null;
    const progressCard = h("div", {
      className: "dsh-rp-retrieval-card"
    }, h("h5", null, "\u7D22\u5F15\u4E0E\u8FDB\u5EA6"), note("\u81EA\u52A8\u7D22\u5F15\u5F00\u5173\u4F4D\u4E8E\u300C\u8BB0\u5FC6\u300DTAB \u7684\u8BB0\u5FC6\u68C0\u7D22\u65B9\u5F0F\u9762\u677F\u3002"), field("\u7D22\u5F15\u5757\u5927\u5C0F\uFF08\u5B57\u7B26\uFF09", h("input", {
      type: "number",
      min: 128,
      max: 2048,
      step: 1,
      value: chunkValue,
      disabled: busy !== null,
      onChange: (e) => {
        chunkDirtyRef.current = true;
        setChunkDirty(true);
        setChunkDraft(e.target.value);
      }
    })), h("div", {
      className: "dsh-rp-row"
    }, h("button", {
      type: "button",
      className: "dsh-rp-btn",
      disabled: busy !== null || !chunkDirty || !chunkValid,
      onClick: saveChunkSize
    }, "\u4FDD\u5B58\u7D22\u5F15\u5757\u5927\u5C0F")), note(`\u9ED8\u8BA4 480\uFF1B\u5EFA\u8BAE 192\uFF08\u7EC6\u7EBF\u7D22\uFF09\u3001480\uFF08\u5747\u8861\uFF09\u3001960\uFF08\u8F83\u957F\u6BB5\u843D\uFF09\u3002\u5F53\u524D\u5B57\u7B26\u76EE\u6807 ${data?.chunkChars ?? 480}\uFF0C\u8303\u56F4 128\u20132048\uFF1B\u5C0F\u8BF4\u7814\u7A76\u4E0E\u5267\u60C5\u5171\u7528\u3002\u5B57\u7B26\u6570\u4E0D\u7B49\u4E8E tokens\uFF1A\u672C\u5730\u4F1A\u6309\u8BE5\u6A21\u578B tokenizer \u4E0E\u7F16\u7801\u9884\u7B97\u7EE7\u7EED\u5206\u6BB5\uFF0C\u4FDD\u8BC1\u542B\u524D\u7F00\u7684\u5B8C\u6574\u8F93\u5165\u4E0D\u88AB\u622A\u65AD\u3002\u8F83\u5927\u5757\u589E\u52A0\u5F00\u9500\u5E76\u964D\u4F4E\u5B9A\u4F4D\u7C92\u5EA6\uFF1B\u66F4\u6539\u9884\u7B97\u6216\u5206\u6BB5\u914D\u65B9\u9700\u91CD\u5EFA\u7D22\u5F15\u3002`), note("\u5757\u5927\u5C0F\u540C\u65F6\u5F71\u54CD\u5267\u60C5\u4E0E\u5C0F\u8BF4\u5411\u91CF\u6307\u7EB9\uFF1B\u4FEE\u6539\u53EA\u6807\u8BB0\u65E7\u7D22\u5F15\u9700\u8981\u91CD\u5EFA\uFF0C\u4E0D\u4F1A\u7ACB\u5373\u6279\u91CF\u91CD\u5EFA\u3002\u6B64\u8BBE\u7F6E\u4FDD\u5B58\u4E8E\u5168\u5C40\u914D\u7F6E\uFF0C\u4E0D\u968F\u4E0B\u65B9\u67E5\u770B\u8FDB\u5EA6\u7684\u4F1A\u8BDD\u9009\u62E9\u6539\u53D8\u3002"), h("div", {
      className: "dsh-rp-row"
    }, button("\u8865\u9F50\u5386\u53F2 / \u91CD\u8BD5\u5931\u8D25", () => void action("reindex")), indexActionButton("\u91CD\u5EFA\u5411\u91CF\u6570\u636E\u5E93", "rebuild-index"), indexActionButton("\u6E05\u7A7A\u5411\u91CF\u6570\u636E\u5E93", "clear-index")), confirmation, note("\u8865\u9F50\u4F1A\u5F00\u542F\u5F53\u524D\u5BF9\u8BDD\u7684\u81EA\u52A8\u7D22\u5F15\uFF0C\u4FDD\u7559\u6210\u529F\u5411\u91CF\u5E76\u8865\u9F50\u7F3A\u5931\u3001\u91CD\u8BD5\u5931\u8D25\u9879\u3002\u8865\u9F50\u3001\u91CD\u5EFA\u548C\u6E05\u7A7A\u53EA\u4F5C\u7528\u4E8E\u5F53\u524D\u53EF\u89C1\u5BF9\u8BDD\u53CA\u5176\u5168\u90E8\u4E16\u754C\u7EBF\uFF1B\u67E5\u770B\u8FDB\u5EA6\u4E0B\u62C9\u4E0D\u6539\u53D8\u64CD\u4F5C\u76EE\u6807\u3002"), field("\u67E5\u770B\u8FDB\u5EA6\u7684\u4F1A\u8BDD", h("select", {
      value: progressSession,
      onChange: (e) => {
        setProgressReply(null);
        setProgressError(null);
        setProgressSession(e.target.value);
      }
    }, h("option", {
      value: sessionId
    }, "\u5F53\u524D\u4F1A\u8BDD"), sessions.filter((s) => s.id !== sessionId).map((s) => h("option", {
      key: s.id,
      value: s.id
    }, s.label)))), note("\u6765\u6E90\u8986\u76D6\u548C\u8FDB\u5EA6\u6570\u5B57\u5C5E\u4E8E\u6240\u9009\u67E5\u770B\u5BF9\u8BDD\uFF1B\u67E5\u770B\u8FDB\u5EA6\u4E0B\u62C9\u53EA\u6539\u53D8\u663E\u793A\uFF0C\u4E0D\u6539\u53D8\u4E0A\u65B9\u5F53\u524D\u5BF9\u8BDD\u7684\u7D22\u5F15\u5F00\u5173\u6216\u5411\u91CF\u7BA1\u7406\u76EE\u6807\u3002"), progress2 ? h("div", {
      className: "dsh-rp-progress"
    }, h("div", null, `\u6B63\u6587\u6765\u6E90 ${progress2.sources} \xB7 \u5DF2\u8986\u76D6 ${progress2.covered}`), h("div", {
      className: "dsh-rp-progress-bar",
      "aria-label": `\u6B63\u6587\u8986\u76D6 ${covered}%`
    }, h("span", {
      style: {
        width: `${covered}%`
      }
    })), progress2.stale ? h("div", {
      className: "dsh-rp-error"
    }, `\u914D\u7F6E\u4E0D\u5339\u914D\uFF0C\u9700\u91CD\u5EFA\u7D22\u5F15\uFF1B\u8BED\u4E49\u7D22\u5F15\u5DF2\u505C\u7528\uFF0C\u65E7\u5411\u91CF ${progress2.staleVectors ?? 0} \u6761\u4E0D\u4F1A\u53C2\u4E0E\u67E5\u8BE2\u3002`) : null, progress2.fingerprint ? note(`\u7D22\u5F15\u6307\u7EB9\uFF1A${progress2.fingerprint.length > 20 ? `${progress2.fingerprint.slice(0, 20)}\u2026` : progress2.fingerprint}`) : null, progress2.embedding ? note(`\u5D4C\u5165\u5143\u6570\u636E\uFF1A${progress2.embedding.embedding_model} \xB7 \u4FEE\u8BA2 ${progress2.embedding.embedding_revision} \xB7 \u7EF4\u5EA6 ${progress2.embedding.dimensions ?? "\u9ED8\u8BA4"} \xB7 task=${progress2.embedding.task} \xB7 pooling=${progress2.embedding.pooling}`) : null, note(`\u6240\u9009\u5BF9\u8BDD\u5411\u91CF\uFF1A${progress2.vectors} \xB7 \u5F85\u5904\u7406 ${progress2.pending} \xB7 \u8FD0\u884C\u4E2D ${progress2.running} \xB7 \u5931\u8D25 ${progress2.failed} \xB7 \u7ED3\u679C\u672A\u77E5 ${progress2.unknown}`), note(`\u5171\u4EAB\u6570\u636E\u5E93\u78C1\u76D8\u5360\u7528\uFF1A${bytes(progress2.bytes)}`), progress2.lastError ? h("div", {
      className: "dsh-rp-error"
    }, progress2.lastError) : null) : note(progressError ?? "\u6B63\u5728\u8BFB\u53D6\u6240\u9009\u4F1A\u8BDD\u8FDB\u5EA6\u2026"));
    const catalogCard = h("div", {
      className: "dsh-rp-retrieval-card"
    }, h("h5", null, "\u672C\u5730\u6A21\u578B\u4E0B\u8F7D"), note("\u672C\u7EC4\u670D\u52A1\u5668\u8BED\u4E49 MRR \u5B9E\u6D4B\u63A8\u8350\uFF1AJina Nano > Nomic v2 MoE > Qwen3 0.6B > BGE small > Jina Small INT8\u3002\u6392\u540D\u4EC5\u57FA\u4E8E 26 \u6761\u6B63\u6587\uFF0F29 \u9053\u6709\u7B54\u6848\u9898\u7684\u5C0F\u6837\u672C\u53EC\u56DE\u7ED3\u679C\uFF1BBGE small \u9002\u5408\u4E2D\u6587\u3001\u901F\u5EA6\u4E0E\u5185\u5B58\u4F18\u5148\uFF1B\u4E0E Small INT8 \u7684 MRR \u5DEE\u8DDD\u5F88\u5C0F\uFF0C\u5728\u7EBF API \u4F18\u5148\u8282\u7701\u672C\u5730\u5185\u5B58\u3002\u672A\u6D4B E5\u3001BGE-M3 \u4E0D\u5217\u5165\u6392\u540D\u3002"), note("\u8FD0\u884C\u73AF\u5883\u4F1A\u6309\u9700\u5B89\u88C5\u6216\u66F4\u65B0\uFF1B\u5DF2\u6821\u9A8C\u7684\u6A21\u578B\u6587\u4EF6\u4F1A\u590D\u7528\uFF0C\u4E0D\u4F1A\u91CD\u590D\u4E0B\u8F7D\u3002"), data?.catalog.map((model) => {
      const pct = model.totalBytes ? Math.min(100, Math.round((model.downloadedBytes ?? 0) / model.totalBytes * 100)) : 0;
      return h("div", {
        className: "dsh-rp-item",
        key: model.id
      }, h("strong", null, model.name), note(`${model.languages} \xB7 ${model.status ?? "not-installed"}`), model.license ? note(`\u8BB8\u53EF\uFF1A${model.license}`) : null, model.description ? note(model.description) : null, note(`${bytes(model.downloadedBytes)} / ${bytes(model.totalBytes)}`), h("div", {
        className: "dsh-rp-progress-bar",
        "aria-label": `${model.name} ${pct}%`
      }, h("span", {
        style: {
          width: `${pct}%`
        }
      })), model.error ? h("div", {
        className: "dsh-rp-error"
      }, model.error) : null, h("div", {
        className: "dsh-rp-row"
      }, button("\u4E0B\u8F7D\uFF0F\u5B89\u88C5", () => void action("download-model", {
        modelId: model.id
      }), model.status === "installed"), button("\u6682\u505C", () => void action("pause-download", {
        modelId: model.id
      }), !["downloading", "installing"].includes(model.status ?? "")), button("\u5220\u9664\u6A21\u578B", () => void action("delete-model", {
        modelId: model.id
      }), model.status === "not-installed")));
    }));
    return h("section", {
      className: "dsh-rp-retrieval",
      "aria-label": view === "memory" ? "\u8BB0\u5FC6\u8BED\u4E49\u68C0\u7D22" : "Embedding \u6A21\u578B\u8BBE\u7F6E",
      "data-dsh-rp-adaptation-model-settings": view === "embedding" ? true : void 0,
      tabIndex: view === "embedding" ? -1 : void 0
    }, ...view === "memory" ? [modeCard] : [providerCard, progressCard, catalogCard], error ? h("div", {
      className: "dsh-rp-error",
      role: "alert"
    }, error) : null);
  }
  function MemoryPanel({ sessionId, LegacyPanel }) {
    return h(LegacyPanel, {
      scope: {
        sessionId
      },
      visible: true,
      retrievalControls: h(RetrievalPanel, {
        sessionId,
        view: "memory"
      })
    });
  }
  function EmbeddingPanel({ sessionId }) {
    return h("div", {
      className: "dsh-rp-panel"
    }, h(RetrievalPanel, {
      sessionId,
      view: "embedding"
    }));
  }
  function RebuildPrompt({ sessionId }) {
    const [pending, setPending] = React.useState(null), [busy, setBusy] = React.useState(false);
    const requestRef = React.useRef(0), sessionRef = React.useRef(sessionId), inFlightRef = React.useRef(false), busyRef = React.useRef(false), pendingRef = React.useRef(null);
    const dialogRef = React.useRef(null), previousFocusRef = React.useRef(null);
    sessionRef.current = sessionId;
    const load = React.useCallback(async () => {
      if (inFlightRef.current || busyRef.current)
        return;
      const request = ++requestRef.current;
      inFlightRef.current = true;
      try {
        const next = await jsonFetch(`/api/roleplay/retrieval-confirmations?sessionId=${encodeURIComponent(sessionId)}`);
        if (request !== requestRef.current || sessionRef.current !== sessionId)
          return;
        if (next.ok === false)
          throw Error(next.error ?? "\u8BFB\u53D6\u91CD\u5EFA\u786E\u8BA4\u5931\u8D25");
        const candidate = next.pending?.[0] ?? null;
        setPending((previous) => {
          if (previous && candidate && previous.id === candidate.id && previous.kind === candidate.kind && previous.model === candidate.model && previous.target === candidate.target && previous.reason === candidate.reason && previous.action === candidate.action)
            return previous;
          pendingRef.current = candidate;
          return candidate;
        });
      } catch {
        if (request === requestRef.current && sessionRef.current === sessionId) {
          pendingRef.current = null;
          setPending(null);
        }
      } finally {
        inFlightRef.current = false;
      }
    }, [jsonFetch, sessionId]);
    React.useEffect(() => {
      requestRef.current++;
      pendingRef.current = null;
      setPending(null);
      busyRef.current = false;
      setBusy(false);
    }, [sessionId]);
    React.useEffect(() => {
      void load();
      const timer = window.setInterval(() => void load(), pending ? 2e3 : 3e4);
      return () => {
        requestRef.current++;
        window.clearInterval(timer);
      };
    }, [sessionId, load, pending]);
    React.useLayoutEffect(() => {
      const dialog = dialogRef.current;
      if (!pending || !dialog)
        return;
      previousFocusRef.current = typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null;
      try {
        if (!dialog.matches?.(":modal"))
          dialog.showModal?.();
      } catch {
        dialog.setAttribute("open", "");
      }
      ;
      dialog.querySelector?.("[data-dsh-rp-rebuild-cancel]")?.focus?.();
      return () => {
        if (dialog.open)
          dialog.close?.();
        const previous = previousFocusRef.current;
        previousFocusRef.current = null;
        previous?.focus?.();
      };
    }, [pending]);
    const submit = async (action) => {
      const target = pending;
      if (!target || busyRef.current || sessionRef.current !== sessionId || pendingRef.current?.id !== target.id)
        return false;
      busyRef.current = true;
      pendingRef.current = null;
      setBusy(true);
      setPending(null);
      requestRef.current++;
      try {
        const next = await jsonFetch("/api/roleplay/retrieval-confirmations", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId,
            id: target.id,
            action
          })
        });
        if (next.ok === false)
          throw Error(next.error ?? "\u91CD\u5EFA\u786E\u8BA4\u64CD\u4F5C\u5931\u8D25");
        if (action === "confirm")
          toast("\u91CD\u5EFA\u4EFB\u52A1\u5DF2\u5728\u540E\u53F0\u542F\u52A8");
        return true;
      } catch (e) {
        toast(`\u91CD\u5EFA\u786E\u8BA4\u64CD\u4F5C\u5931\u8D25\uFF1A${String(e instanceof Error ? e.message : e)}`);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    };
    const close = (event) => {
      event.preventDefault();
      event.stopPropagation();
      void submit("cancel");
    };
    const trap = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        void submit("cancel");
        return;
      }
      if (event.key !== "Tab")
        return;
      const dialog = dialogRef.current;
      if (!dialog)
        return;
      const focusable = Array.from(dialog.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length)
        return;
      const current = focusable.indexOf(document.activeElement), next = (current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      event.preventDefault();
      focusable[next]?.focus();
    };
    if (!pending)
      return null;
    const configure = pending.action === "configure-adaptation-model";
    const purpose = pending.kind === "novel" ? "\u5C0F\u8BF4\u539F\u6587\u7D22\u5F15\u4E0E\u68C0\u7D22" : "\u5267\u60C5\u8BB0\u5FC6\u7D22\u5F15\u4E0E\u68C0\u7D22";
    return h("dialog", {
      ref: dialogRef,
      className: "dsh-rp-stale-confirm",
      "role": "alertdialog",
      "aria-modal": "true",
      "aria-labelledby": "dsh-rp-rebuild-title",
      onCancel: close,
      onKeyDown: trap
    }, h("h6", {
      id: "dsh-rp-rebuild-title"
    }, configure ? "\u7C97\u9897\u7C92\u5EA6\u9700\u8981\u5C0F\u8BF4\u68C0\u7D22\u6A21\u578B" : "\u9700\u8981\u786E\u8BA4\u91CD\u5EFA\u8BED\u4E49\u7D22\u5F15"), note(configure ? "\u7C97\u9897\u7C92\u5EA6\u7814\u7A76\u9700\u8981\u53EF\u7528\u7684\u5C0F\u8BF4\u4E13\u7528 Embedding \u6A21\u578B\uFF1B\u5F53\u524D\u751F\u6210\u8F6E\u6B21\u5DF2\u505C\u6B62\u3002\u8BF7\u5148\u914D\u7F6E\u5E76\u6D4B\u8BD5\u5C0F\u8BF4\u6A21\u578B\u3002" : `\u7528\u9014\uFF1A${purpose}`), configure ? null : note(`\u6A21\u578B\uFF1A${pending.model}`), configure ? null : note(`\u76EE\u6807\uFF1A${pending.target}`), note(`\u539F\u56E0\uFF1A${pending.reason}`), configure ? note("\u786E\u8BA4\u540E\u53EA\u5173\u95ED\u63D0\u793A\uFF0C\u4E0D\u4F1A\u542F\u52A8\u7D22\u5F15\u91CD\u5EFA\u3002") : note("\u5728\u7EBF\u6A21\u578B\u91CD\u5EFA\u53EF\u80FD\u4EA7\u751F API \u8D39\u7528\uFF1B\u786E\u8BA4\u540E\u5C06\u5728\u540E\u53F0\u542F\u52A8\u3002"), h("div", {
      className: "dsh-rp-row"
    }, h("button", {
      type: "button",
      className: "dsh-rp-btn",
      "data-dsh-rp-rebuild-cancel": true,
      disabled: busy,
      onClick: () => void submit("cancel")
    }, configure ? "\u5173\u95ED" : "\u53D6\u6D88"), h("button", {
      type: "button",
      className: "dsh-rp-btn dsh-rp-primary",
      "data-dsh-rp-rebuild-confirm": true,
      disabled: busy,
      onClick: () => {
        if (configure) {
          void (async () => {
            if (await submit("cancel"))
              window.dispatchEvent(new CustomEvent("dsh-roleplay-needs-config", {
                detail: {
                  sessionId,
                  action: "configure-adaptation-model"
                }
              }));
          })();
        } else
          void submit("confirm");
      }
    }, configure ? "\u524D\u5F80\u914D\u7F6E" : "\u786E\u8BA4\u5E76\u91CD\u5EFA")));
  }
  return {
    MemoryPanel,
    EmbeddingPanel,
    RebuildPrompt
  };
}

// card-adaptation-presentations.js
var bytes2 = (value) => value >= 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MiB` : `${Math.round(value / 1024)} KiB`;
var progress = (value, total) => typeof value === "number" ? `${value}/${total}` : value ? `${total}/${total}` : `0/${total}`;
var statusLabel = (value) => value === "reading" ? "\u9605\u8BFB\u4E2D" : value === "finished" ? "\u7814\u7A76\u5B8C\u6210" : value;
var indexStatus = (source, index) => {
  if (source?.indexPolicy === "completed" && index?.stale !== true)
    return "\u5DF2\u5B8C\u6210";
  if (index && (index.failed > 0 || index.unknown > 0))
    return "\u9700\u91CD\u8BD5";
  if (index?.stale === true)
    return "\u7B49\u5F85\u91CD\u5EFA";
  if (index?.enabled === false)
    return "\u6682\u505C";
  return "\u8FD0\u884C";
};
function createCardAdaptationPresentations(React) {
  const h = React.createElement;
  const field = (label, node) => h("label", { className: "dsh-rp-adaptation-field" }, label, node);
  const muted = (value) => h("p", { className: "dsh-rp-muted" }, value);
  const buttons = (busy, confirming) => (label, action, disabled = false, primary = false) => h("button", {
    type: "button",
    className: `dsh-rp-btn${primary ? " dsh-rp-primary" : ""}`,
    disabled: busy !== null || confirming || disabled,
    onClick: action
  }, label);
  function renderSourceCards({ data, source, hasSources, busy, confirming, draft, modelSelection, modelDirty, modelSettingsRef, changeModelSelection, selectModel, selectSource, toggleAutoIndex, toggleAutoRebuild, libraryMutation, indexAction, pauseIndex }) {
    const actionButton = buttons(busy, confirming);
    const semanticModels = data?.semanticModels ?? [];
    const index = data?.index;
    const totalVectors = index ? index.vectors + index.pending + index.running + index.failed + index.unknown : 0;
    const vectorPercent = totalVectors ? Math.min(100, Math.round(index.vectors / totalVectors * 100)) : 0;
    const semanticCard = h("div", { className: "dsh-rp-adaptation-card" }, h("h5", null, "\u5C0F\u8BF4\u7814\u7A76\u6A21\u578B\uFF08\u5168\u5C40\uFF09"), muted("\u4E0E Embedding \u8BBE\u7F6E\u5171\u7528\u540C\u4E00\u7EC4\u4F9B\u5E94\u5546\u548C\u6A21\u578B\uFF0C\u4E0D\u5728\u8FD9\u91CC\u91CD\u590D\u914D\u7F6E\u4F9B\u5E94\u5546\u3002\u6B64\u9009\u62E9\u4EC5\u5F71\u54CD\u5C0F\u8BF4\u539F\u6587\u7D22\u5F15\u548C\u68C0\u7D22\uFF0C\u4E0D\u6539\u53D8\u5267\u60C5\u8BB0\u5FC6\u6A21\u578B\uFF1B\u4FDD\u7559\u5DF2\u6709\u7D22\u5F15\uFF0C\u914D\u7F6E\u4E0D\u5339\u914D\u65F6\u53EF\u518D\u4FEE\u590D\u7D22\u5F15\u3002"), data ? field("\u6A21\u578B", h("select", {
      ref: (element) => {
        modelSettingsRef.current = element;
      },
      "data-dsh-rp-novel-model-settings": true,
      className: "dsh-rp-input",
      value: modelSelection,
      disabled: busy !== null || confirming || !!draft,
      onChange: (e) => changeModelSelection(e.target.value)
    }, h("option", { value: "" }, "\u672A\u9009\u62E9\uFF08\u4E0D\u7EE7\u627F\u5267\u60C5\u8BB0\u5FC6\u6A21\u578B\uFF09"), semanticModels.map((item) => h("option", { key: item.id, value: item.id, disabled: !item.ready }, `${item.name} \xB7 ${item.model}${item.ready ? "" : "\uFF08\u672A\u5C31\u7EEA\uFF09"}`)))) : muted("\u6B63\u5728\u8BFB\u53D6\u8BED\u4E49\u6A21\u578B\u2026"), data && h("div", { className: "dsh-rp-adaptation-actions" }, actionButton("\u5E94\u7528\u5C0F\u8BF4\u7814\u7A76\u6A21\u578B", selectModel, !!modelSelection && !semanticModels.some((item) => item.id === modelSelection && item.ready) || !modelDirty, true)), data && modelDirty && muted("\u6709\u672A\u5E94\u7528\u7684\u5C0F\u8BF4\u7814\u7A76\u6A21\u578B\u9009\u62E9\u3002"), data && h("div", { className: "dsh-rp-adaptation-field" }, h("label", null, h("input", {
      type: "checkbox",
      checked: data.autoIndexNewSources,
      disabled: busy !== null || confirming,
      onChange: toggleAutoIndex
    }), " \u5BFC\u5165\u6216\u5173\u8054\u5C0F\u8BF4\u65F6\u81EA\u52A8\u51C6\u5907\u8BED\u4E49\u7D22\u5F15"), muted("\u4EC5\u5BF9\u65B0\u5BFC\u5165\u6216\u65B0\u5173\u8054\u7684\u539F\u8457\u751F\u6548\u3002\u6A21\u578B\u53EF\u7528\u65F6\u81EA\u52A8\u5EFA\u5E93\uFF0C\u5DF2\u6709\u517C\u5BB9\u7D22\u5F15\u4FDD\u7559\u5E76\u8865\u7F3A\u3001\u91CD\u8BD5\u5931\u8D25\u6216\u672A\u77E5\u4EFB\u52A1\uFF1B\u5728\u7EBF\u6A21\u578B\u53EF\u80FD\u4EA7\u751F\u8D39\u7528\u3002\u4E0D\u6062\u590D\u5F53\u524D\u5BF9\u8BDD\u5DF2\u6682\u505C\u6216\u6E05\u7A7A\u7684\u8D44\u6599\u3002")), data && h("div", { className: "dsh-rp-adaptation-field" }, h("label", null, h("input", {
      type: "checkbox",
      checked: data.autoRebuildLocalOnActive,
      disabled: busy !== null || confirming,
      onChange: toggleAutoRebuild
    }), " \u7814\u7A76\u6D3B\u8DC3\u65F6\u81EA\u52A8\u91CD\u5EFA\u5F02\u5E38\u7D22\u5F15\uFF08\u4EC5\u672C\u5730\u6A21\u578B\uFF09"), muted("\u5F53\u524D\u539F\u8457\u5B9E\u9645\u68C0\u7D22\u9047\u5230\u6A21\u578B\u6307\u7EB9\u53D8\u5316\u6216\u7D22\u5F15\u635F\u574F\u65F6\uFF0C\u81EA\u52A8\u4FEE\u590D\u5F53\u524D\u672C\u5730\u7D22\u5F15\uFF1B\u4E0D\u6279\u91CF\u91CD\u5EFA\uFF0C\u4E0D\u5904\u7406\u7F51\u7EDC\u6216\u8BA4\u8BC1\u9519\u8BEF\uFF0C\u4E0D\u6062\u590D\u5DF2\u6682\u505C\u8D44\u6599\u3002")));
    const libraryAssets = data?.library?.assets ?? [];
    const libraryCard = h("div", { className: "dsh-rp-adaptation-card" }, h("h5", null, "\u539F\u8457\u8D44\u6599\u5E93"), muted("\u540C\u4E00\u672C\u539F\u8457\u53EA\u9700\u5EFA\u5E93\u4E00\u6B21\u3002\u591A\u4E2A\u72EC\u7ACB\u5BF9\u8BDD\u81EA\u52A8\u590D\u7528\u539F\u8457\u7814\u7A76\u7B14\u8BB0\u4E0E\u9605\u8BFB\u65AD\u70B9\uFF1B\u5F53\u524D\u5361\u7684\u7B14\u8BB0\u4FEE\u6539\u72EC\u7ACB\u4FDD\u5B58\uFF0C\u6539\u7F16\u8BBE\u60F3\u4E0D\u81EA\u52A8\u6210\u4E3A\u5267\u60C5\u3002"), libraryAssets.length ? field("\u5DF2\u767B\u8BB0\u539F\u8457", h("select", {
      className: "dsh-rp-input",
      value: "",
      disabled: busy !== null || confirming || !!draft,
      onChange: (e) => {
        if (e.target.value)
          libraryMutation("attach-source", e.target.value);
      }
    }, h("option", { value: "" }, "\u9009\u62E9\u8981\u590D\u7528\u7684\u539F\u8457"), libraryAssets.map((asset) => h("option", { key: asset.assetId, value: asset.assetId }, `${asset.name} \xB7 ${bytes2(asset.bytes)} \xB7 ${asset.references} \u4E2A\u5BF9\u8BDD${asset.attached ? " \xB7 \u5F53\u524D\u5DF2\u5F15\u7528" : ""}`)))) : muted(data ? "\u5F53\u524D\u6CA1\u6709\u53EF\u9009\u5171\u4EAB\u539F\u8457\uFF1B\u8BF7\u5148\u5728\u5F53\u524D\u5BF9\u8BDD\u767B\u8BB0 TXT \u540E\u5171\u4EAB\u3002" : "\u6B63\u5728\u8BFB\u53D6\u539F\u8457\u8D44\u6599\u5E93\u2026"), source && !source.assetId ? actionButton("\u5171\u4EAB\u8FD9\u672C\u539F\u8457", () => void libraryMutation("publish-source"), false, true) : null, data?.shared ? h("div", { className: "dsh-rp-adaptation-meta" }, h("span", null, `\u81EA\u52A8\u590D\u7528\u539F\u8457\u7814\u7A76\u7B14\u8BB0\u4E0E\u9605\u8BFB\u65AD\u70B9 \xB7 \u5F53\u524D\u5361\u4FEE\u6539\u72EC\u7ACB\u4FDD\u5B58 \xB7 \u5171\u4EAB\u8303\u56F4 ${data.shared.references} \u4E2A\u5BF9\u8BDD`), actionButton("\u89E3\u9664\u672C\u5BF9\u8BDD\u5F15\u7528", () => void libraryMutation("detach-source"))) : null, libraryAssets.filter((asset) => asset.references === 0).map((asset) => h("div", { key: `delete-${asset.assetId}`, className: "dsh-rp-adaptation-actions" }, h("span", null, `${asset.name} \xB7 \u65E0\u5F15\u7528`), actionButton("\u5220\u9664\u5171\u4EAB\u539F\u8457", () => void libraryMutation("delete-original", asset.assetId)))));
    const sourceCard = h("div", { className: "dsh-rp-adaptation-card" }, h("h5", null, "\u5C0F\u8BF4\u539F\u6587"), muted("\u9009\u62E9\u8981\u6574\u7406\u7684\u5C0F\u8BF4\u539F\u6587\u3002\u591A\u4E2A\u5BF9\u8BDD\u81EA\u52A8\u590D\u7528\u539F\u8457\u7814\u7A76\u7B14\u8BB0\u4E0E\u9605\u8BFB\u65AD\u70B9\uFF1B\u5F53\u524D\u5361\u7684\u7B14\u8BB0\u4FEE\u6539\u72EC\u7ACB\u4FDD\u5B58\uFF0C\u6539\u7F16\u8BBE\u60F3\u4E0D\u81EA\u52A8\u6210\u4E3A\u5267\u60C5\u3002"), hasSources ? field("\u5C0F\u8BF4", h("select", {
      className: "dsh-rp-input",
      value: source?.sourceId ?? "",
      disabled: busy !== null || confirming || !!draft,
      onChange: (e) => selectSource(e.target.value)
    }, data.sources.map((item) => h("option", { key: item.sourceId, value: item.sourceId }, item.name)))) : null, source ? h("div", { className: "dsh-rp-adaptation-meta" }, h("span", null, `${source.name} \xB7 ${bytes2(source.bytes)} \xB7 ${source.characters.toLocaleString()} \u5B57 \xB7 ${source.segments} \u6BB5`), h("span", null, `\u5DF2\u8BFB\uFF1A${progress(source.read, source.segments)}`), h("span", null, `\u5DF2\u8BB0\u7B14\u8BB0\uFF1A${progress(source.reviewed, source.segments)}`), h("span", null, `\u72B6\u6001\uFF1A${statusLabel(source.status)}`)) : null, source?.requiresReregister ? h("div", { className: "dsh-rp-error", role: "alert" }, "\u65E7\u5206\u6BB5\u53EF\u80FD\u53D7\u8F93\u51FA\u4E0A\u9650\u622A\u65AD\uFF0C\u65E7\u5DF2\u8BFB\u6807\u8BB0\u4E0D\u80FD\u8BC1\u660E\u5168\u6587\u9001\u8FBE\u3002\u8BF7\u91CD\u65B0\u767B\u8BB0\u539F\u6587\u4EF6\u540E\u5B8C\u6574\u91CD\u8BFB\uFF1B\u65E7\u7814\u7A76\u7B14\u8BB0\u4F1A\u4FDD\u7559\u3002") : null, data?.shared ? muted("\u81EA\u52A8\u590D\u7528\u539F\u8457\u7814\u7A76\u7B14\u8BB0\u4E0E\u9605\u8BFB\u65AD\u70B9\uFF1B\u5F53\u524D\u5361\u7684\u7B14\u8BB0\u4FEE\u6539\u72EC\u7ACB\u4FDD\u5B58\uFF0C\u6539\u7F16\u8BBE\u60F3\u4E0D\u81EA\u52A8\u6210\u4E3A\u5267\u60C5\u3002") : null, !hasSources && h("p", { role: "status" }, data ? "\u5C1A\u65E0\u5C0F\u8BF4\u539F\u6587\u3002\u8BF7\u5148\u5728\u8D44\u6E90\u5E93\u4E0A\u4F20 TXT\uFF0C\u518D\u5411 Agent \u63D0\u51FA\u6539\u7F16\u8981\u6C42\u3002" : "\u6B63\u5728\u8BFB\u53D6\u539F\u6587\u2026"));
    const indexCard = h("div", { className: "dsh-rp-adaptation-card" }, h("h5", null, "\u5411\u91CF\u7D22\u5F15"), muted("\u5411\u91CF\u6A21\u578B\u4F7F\u7528\u4E0A\u65B9\u7684\u5C0F\u8BF4\u7814\u7A76\u6A21\u578B\uFF08\u5168\u5C40\uFF09\u8BBE\u7F6E\u3002\u8FD9\u91CC\u53EF\u4E3B\u52A8\u7BA1\u7406\u5C0F\u8BF4\u7D22\u5F15\uFF0C\u8FD0\u884C\u72B6\u6001\u4E0E\u5267\u60C5\u81EA\u52A8\u7D22\u5F15\u65E0\u5173\u3002"), index ? h("div", { className: "dsh-rp-adaptation-progress" }, h("div", null, `\u5F53\u524D\u6A21\u578B\uFF1A${index.model || "\u672A\u914D\u7F6E"} \xB7 \u5DF2\u5B8C\u6210 ${index.vectors}/${totalVectors || 0}`), h("div", { className: "dsh-rp-adaptation-progress-bar", "aria-label": `\u5411\u91CF\u7D22\u5F15 ${vectorPercent}%` }, h("span", { style: { width: `${vectorPercent}%` } })), h("div", { className: "dsh-rp-adaptation-meta" }, `\u5F85\u5904\u7406 ${index.pending}`, `\u8FD0\u884C\u4E2D ${index.running}`, `\u5931\u8D25 ${index.failed}`, `\u672A\u77E5 ${index.unknown}`, `\u540E\u53F0\u7D22\u5F15\uFF1A${indexStatus(source, index)}`, index.stale ? "\u914D\u7F6E\u4E0D\u5339\u914D\uFF0C\u65E7\u5411\u91CF\u4E0D\u53C2\u4E0E\u67E5\u8BE2\uFF1B\u53EF\u91CD\u5EFA\u7D22\u5F15" : null), data?.indexError ? h("div", { className: "dsh-rp-error" }, data.indexError) : null) : muted("\u6B63\u5728\u8BFB\u53D6\u5411\u91CF\u8FDB\u5EA6\u2026"), h("div", { className: "dsh-rp-adaptation-actions" }, actionButton("\u8865\u9F50\u7F3A\u5C11\u6216\u91CD\u8BD5\u5931\u8D25", () => indexAction("resume-index"), !hasSources || !!draft), actionButton("\u6682\u505C\u7D22\u5F15", pauseIndex, !hasSources || !!draft), actionButton("\u6E05\u7A7A\u5411\u91CF", () => indexAction("clear-index"), !hasSources || !!draft), actionButton("\u91CD\u5EFA\u5411\u91CF", () => indexAction("rebuild-index"), !hasSources || !!draft)), muted("\u6682\u505C\u53EA\u5F71\u54CD\u672C\u5BF9\u8BDD\u7684\u7D22\u5F15\u8BF7\u6C42\uFF0C\u5176\u4ED6\u5F15\u7528\u7EE7\u7EED\uFF1B\u89E3\u9664\u5F15\u7528\u4ECD\u4FDD\u7559\u5F53\u524D\u5361\u8986\u76D6\u3001\u5171\u4EAB\u539F\u6587\u548C\u5411\u91CF\u3002"));
    return { libraryCard, semanticCard, sourceCard, indexCard };
  }
  function renderResearchCards({ data, source, hasSources, busy, confirming, draft, researchMode, researchProtagonist, researchOpeningPoint, researchDirty, maxQueryBatches, maxReadPackets, noteView, queryDraft, editingSegment, refreshing, setResearchMode, setResearchProtagonist, setResearchOpeningPoint, setMaxQueryBatches, setMaxReadPackets, markResearchDirty, chooseResearchMode, saveResearchBudget, toggleResearchPause, changeNoteView, setQueryDraft, search, refreshNotes, clearNotes, updateDraft, saveDraft, cancelEdit, startEdit, deleteNote, loadMoreNotes }) {
    const actionButton = buttons(busy, confirming);
    const notes = data?.notes ?? [];
    const research = data?.research;
    const coveredBins = research?.coverage.bins.filter((bin) => bin.covered).length ?? 0;
    const researchCard = research && source ? h("div", { className: "dsh-rp-adaptation-card" }, h("h5", null, "\u9605\u8BFB\u4E0E\u6539\u7F16\u6A21\u5F0F"), muted("\u5148\u9009\u62E9\u539F\u8457\u9605\u8BFB\u7B56\u7565\uFF0C\u518D\u5F00\u59CB\u9605\u8BFB\u7B14\u8BB0\u3002\u539F\u521B\u4E92\u52A8\u5199\u5361\u4E0E\u8FD9\u91CC\u72EC\u7ACB\uFF1B\u5207\u6362\u6A21\u5F0F\u4E0D\u4F1A\u5220\u9664\u7D22\u5F15\u6216\u539F\u6587\u3002"), h("div", { className: "dsh-rp-adaptation-grid" }, field("\u9605\u8BFB\u6A21\u5F0F", h("select", {
      className: "dsh-rp-input",
      value: researchMode ?? "",
      disabled: busy !== null || confirming,
      onChange: (e) => {
        const value = e.target.value;
        setResearchMode(value || null);
        markResearchDirty();
      }
    }, h("option", { value: "" }, "\u8BF7\u9009\u62E9"), h("option", { value: "close-reading" }, "\u7CBE\u8BFB"), h("option", { value: "coarse" }, "\u7C97\u9897\u7C92\u5EA6"))), field("\u4E3B\u89D2\u540D\uFF08\u7C97\u9897\u7C92\u5EA6\u5FC5\u586B\uFF09", h("input", {
      className: "dsh-rp-input",
      value: researchProtagonist,
      disabled: busy !== null || confirming,
      onChange: (e) => {
        setResearchProtagonist(e.target.value);
        markResearchDirty();
      }
    })), field("\u5F00\u7BC7\u4F4D\u7F6E", h("input", {
      className: "dsh-rp-input",
      value: researchOpeningPoint,
      disabled: busy !== null || confirming,
      placeholder: "\u4F8B\u5982\uFF1A\u7B2C 1 \u7AE0",
      onChange: (e) => {
        setResearchOpeningPoint(e.target.value);
        markResearchDirty();
      }
    }))), researchMode === "close-reading" ? muted("\u7CBE\u8BFB\uFF1A\u5B8C\u6574\u901A\u8BFB\u539F\u8457\uFF0C\u8017\u65F6\u8F83\u9AD8\uFF0C\u9002\u5408\u9700\u8981\u8FDE\u7EED\u7EC6\u8282\u548C\u5B8C\u6574\u80CC\u666F\u7684\u6539\u7F16\u3002") : researchMode === "coarse" ? muted("\u7C97\u9897\u7C92\u5EA6\uFF1A\u5B9A\u5411\u8BC1\u636E + \u5168\u5C40\u5206\u5C42\u62BD\u67E5\uFF1B\u8986\u76D6\u6709\u9650\uFF0C\u4E0D\u80FD\u58F0\u79F0\u8BFB\u5B8C\u6574\u672C\u539F\u8457\u3002") : muted("\u8BF7\u9009\u62E9\u7CBE\u8BFB\u6216\u7C97\u9897\u7C92\u5EA6\u6A21\u5F0F\u3002"), h("div", { className: "dsh-rp-adaptation-actions" }, actionButton("\u786E\u8BA4\u9605\u8BFB\u6A21\u5F0F", () => chooseResearchMode(researchMode), !researchMode || researchMode === "coarse" && !researchProtagonist.trim() || !researchDirty, true)), h("div", { className: "dsh-rp-adaptation-grid" }, field("\u6700\u5927\u68C0\u7D22\u6279\u6B21\uFF081\u2013200\uFF09", h("input", {
      className: "dsh-rp-input",
      type: "number",
      min: 1,
      max: 200,
      value: maxQueryBatches,
      disabled: busy !== null || confirming,
      onChange: (e) => {
        setMaxQueryBatches(e.target.value);
        markResearchDirty();
      }
    })), field("\u6700\u5927\u9605\u8BFB\u5305\uFF081\u2013500\uFF09", h("input", {
      className: "dsh-rp-input",
      type: "number",
      min: 1,
      max: 500,
      value: maxReadPackets,
      disabled: busy !== null || confirming,
      onChange: (e) => {
        setMaxReadPackets(e.target.value);
        markResearchDirty();
      }
    }))), h("div", { className: "dsh-rp-adaptation-actions" }, actionButton("\u4FDD\u5B58\u7814\u7A76\u9884\u7B97", saveResearchBudget, !researchDirty, true), actionButton(research.status === "paused" ? "\u6062\u590D\u7814\u7A76" : "\u6682\u505C\u7814\u7A76", toggleResearchPause, research.status === "finished")), h("div", { className: "dsh-rp-adaptation-meta" }, `\u72B6\u6001\uFF1A${research.status}`, `\u8986\u76D6\u533A\u95F4\uFF1A${coveredBins}/${research.coverage.bins.length}`, `\u68C0\u7D22\u6279\u6B21\uFF1A${research.budget.queryBatches}/${research.budget.maxQueryBatches}`, `\u9605\u8BFB\u5305\uFF1A${research.budget.readPackets}/${research.budget.maxReadPackets}`), research.coverage.caveat ? muted(research.coverage.caveat) : null, research.coverage.missing.length ? h("div", { className: "dsh-rp-error" }, `\u7F3A\u9879\uFF1A${research.coverage.missing.join("\u3001")}`) : muted("\u5F53\u524D\u6CA1\u6709\u767B\u8BB0\u7F3A\u9879\uFF1B\u8FD9\u4E0D\u4EE3\u8868\u5DF2 100% \u7406\u89E3\u539F\u8457\u3002")) : null;
    const coarseNotes = data?.researchNotes?.entries ?? [];
    const coarseEntry = (entry) => h("article", { className: "dsh-rp-adaptation-note", key: entry.id }, h("h6", null, `\u3010${entry.category}\u3011${entry.certainty}`), h("p", null, entry.statement), entry.citations?.length ? h("p", null, h("strong", null, "\u539F\u8457\u8BC1\u636E\uFF1A"), entry.citations.map((citation, index) => h("span", { key: `${entry.id}-citation-${index}` }, `${index ? "\uFF1B" : ""}\u7247\u6BB5 ${citation.segment} @${citation.start}\uFF1A\u201C${citation.quote}\u201D`))) : null, entry.storyOccursAt || entry.readerRevealedAt || entry.characterKnowledge ? h("p", null, h("strong", null, "\u65F6\u95F4\u4E0E\u77E5\u60C5\uFF1A"), [
      entry.storyOccursAt ? `\u6545\u4E8B\u53D1\u751F ${entry.storyOccursAt}` : "",
      entry.readerRevealedAt ? `\u8BFB\u8005\u63ED\u9732 ${entry.readerRevealedAt}` : "",
      entry.characterKnowledge ? `\u89D2\u8272\u77E5\u60C5 ${entry.characterKnowledge}` : ""
    ].filter(Boolean).join("\uFF1B")) : null, entry.chain ? h("p", null, h("strong", null, "\u5173\u952E\u56E0\u679C\u94FE\uFF1A"), JSON.stringify(entry.chain)) : null);
    const notesCard = h("div", { className: "dsh-rp-adaptation-card" }, h("h5", null, "\u7814\u7A76\u7B14\u8BB0"), h("div", { className: "dsh-rp-adaptation-actions" }, actionButton("\u7CBE\u8BFB\u7B14\u8BB0", () => changeNoteView("close-reading"), noteView === "close-reading"), actionButton("\u7C97\u9897\u7C92\u5EA6\u7B14\u8BB0", () => changeNoteView("coarse"), noteView === "coarse")), h("div", { className: "dsh-rp-adaptation-actions" }, field("\u5173\u952E\u8BCD", h("input", {
      className: "dsh-rp-input",
      value: queryDraft,
      disabled: busy !== null || confirming || !!draft,
      placeholder: noteView === "coarse" ? "\u641C\u7D22\u539F\u8457\u4E8B\u5B9E\u3001\u4EBA\u7269\u3001\u4E8B\u4EF6\u6216\u56E0\u679C\u94FE" : "\u641C\u7D22\u4E8B\u5B9E\u3001\u6539\u7F16\u3001\u7591\u95EE\u6216\u8BC1\u636E",
      onChange: (e) => setQueryDraft(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter")
          search();
      }
    })), actionButton("\u641C\u7D22", search, !!draft, true), actionButton("\u5237\u65B0\u7B14\u8BB0", refreshNotes, !!draft), noteView === "close-reading" ? actionButton("\u6E05\u7A7A\u5168\u90E8\u7B14\u8BB0", clearNotes, !hasSources || !!draft) : null), noteView === "coarse" ? coarseNotes.length ? h("div", { className: "dsh-rp-adaptation-grid" }, coarseNotes.map(coarseEntry)) : muted(data ? "\u5F53\u524D\u6CA1\u6709\u7C97\u9897\u7C92\u5EA6\u539F\u8457\u77E5\u8BC6\u6761\u76EE\u3002" : "\u6B63\u5728\u8BFB\u53D6\u7C97\u9897\u7C92\u5EA6\u7B14\u8BB0\u2026") : notes.length ? h("div", { className: "dsh-rp-adaptation-grid" }, notes.map((note) => {
      const editing = editingSegment === note.segment && !!draft;
      const current = editing ? draft : note;
      return h("article", { className: "dsh-rp-adaptation-note", key: `${note.segment}:${note.seq}` }, h("h6", null, `\u7247\u6BB5 ${note.segment}`), editing ? h("div", { className: "dsh-rp-adaptation-grid" }, field("\u4E8B\u5B9E", h("textarea", {
        value: current.facts,
        disabled: busy !== null,
        onChange: (e) => updateDraft("facts", e.target.value)
      })), field("\u6539\u7F16", h("textarea", {
        value: current.implications,
        disabled: busy !== null,
        onChange: (e) => updateDraft("implications", e.target.value)
      })), field("\u7591\u95EE", h("textarea", {
        value: current.questions,
        disabled: busy !== null,
        onChange: (e) => updateDraft("questions", e.target.value)
      })), field("\u8BC1\u636E", h("textarea", {
        value: current.evidence,
        disabled: busy !== null,
        onChange: (e) => updateDraft("evidence", e.target.value)
      })), h("div", { className: "dsh-rp-adaptation-actions" }, actionButton("\u4FDD\u5B58\u7B14\u8BB0", saveDraft, false, true), actionButton("\u53D6\u6D88\u7F16\u8F91", cancelEdit))) : h("div", null, h("p", null, h("strong", null, "\u539F\u8457\u4E8B\u5B9E\uFF1A"), current.facts || "\uFF08\u6682\u65E0\u4E8B\u5B9E\uFF09"), h("p", null, h("strong", null, "\u6539\u7F16\u8BBE\u60F3\uFF1A"), current.implications || "\uFF08\u6682\u65E0\u6539\u7F16\u63D0\u793A\uFF09"), h("p", null, h("strong", null, "\u5F85\u6838\u5B9E\uFF1A"), current.questions || "\uFF08\u6682\u65E0\u7591\u95EE\uFF09"), h("p", null, h("strong", null, "\u539F\u53E5\u8BC1\u636E\uFF1A"), current.evidence || "\uFF08\u6682\u65E0\u8BC1\u636E\uFF09"), h("div", { className: "dsh-rp-adaptation-actions" }, actionButton("\u7F16\u8F91", () => startEdit(note), false, true), actionButton("\u5220\u9664", () => deleteNote(note.segment)))));
    })) : muted(data ? "\u5F53\u524D\u7B5B\u9009\u6CA1\u6709\u7814\u7A76\u7B14\u8BB0\u3002\u8F93\u5165\u5173\u952E\u8BCD\u540E\u641C\u7D22\uFF0C\u6216\u4ECE\u539F\u6587\u6574\u7406\u65B0\u7684\u8D44\u6599\u3002" : "\u6B63\u5728\u8BFB\u53D6\u7814\u7A76\u7B14\u8BB0\u2026"), noteView === "coarse" ? data?.researchNotes?.nextCursor != null ? actionButton("\u52A0\u8F7D\u66F4\u591A\u7C97\u9897\u7C92\u5EA6\u7B14\u8BB0", () => loadMoreNotes("coarse"), !!draft) : null : data?.nextCursor != null ? actionButton("\u52A0\u8F7D\u66F4\u591A", () => loadMoreNotes("close-reading"), !!draft) : null, h("div", { className: "dsh-rp-adaptation-refresh-slot", "aria-live": "polite" }, refreshing ? muted("\u540E\u53F0\u5237\u65B0\u4E2D\u2026") : null));
    return { researchCard, notesCard };
  }
  return { renderSourceCards, renderResearchCards };
}

// card-adaptation-panel.js
var CARD_ADAPTATION_CSS = `
.dsh-rp-adaptation{display:grid;gap:14px;margin:12px 0}
.dsh-rp-adaptation-card{display:grid;gap:12px;padding:16px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#fff)}
.dsh-rp-adaptation-card h5,.dsh-rp-adaptation-card p{margin:0}
.dsh-rp-adaptation-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}
.dsh-rp-adaptation-field{display:grid;gap:5px;min-width:0}
.dsh-rp-adaptation-field input,.dsh-rp-adaptation-field select,.dsh-rp-adaptation-field textarea{width:100%;min-width:0;box-sizing:border-box;padding:8px}
.dsh-rp-adaptation-note{display:grid;gap:9px;padding:12px;border:1px solid var(--dsw-alias-border-l2,#d8dee8);border-radius:10px}
.dsh-rp-adaptation-note h6,.dsh-rp-adaptation-note p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.dsh-rp-adaptation-note textarea{min-height:66px;resize:vertical}
.dsh-rp-adaptation-meta{display:flex;flex-wrap:wrap;gap:6px;color:var(--dsw-alias-text-secondary,#667085);font-size:12px}
.dsh-rp-adaptation-progress{display:grid;gap:7px}.dsh-rp-adaptation-progress-bar{height:7px;overflow:hidden;border-radius:99px;background:rgba(100,120,145,.18)}
.dsh-rp-adaptation-progress-bar>span{display:block;height:100%;background:var(--dsw-alias-brand-primary,#3375db)}
.dsh-rp-adaptation-actions{display:flex;align-items:flex-end;flex-wrap:wrap;gap:8px}
.dsh-rp-adaptation-refresh-slot{min-height:18px}
`;
var noteDraft = (note) => ({
  segment: note.segment,
  facts: note.facts,
  implications: note.implications,
  questions: note.questions,
  evidence: note.evidence,
  seq: note.seq
});
function createCardAdaptationPanel({ React, jsonFetch, toast, confirmWithDialog: confirmWithDialog2, onNeedsConfig }) {
  const h = React.createElement;
  const { renderSourceCards, renderResearchCards } = createCardAdaptationPresentations(React);
  return function CardAdaptationPanel({ sessionId, focusModelSettings = false, focusModelSettingsNonce = 0 }) {
    const [data, setData] = React.useState(null);
    const [selectedId, setSelectedId] = React.useState("");
    const [modelSelection, setModelSelection] = React.useState("");
    const [modelDirty, setModelDirty] = React.useState(false);
    const [queryDraft, setQueryDraft] = React.useState("");
    const [query, setQuery] = React.useState("");
    const [editingSegment, setEditingSegment] = React.useState(null);
    const [draft, setDraft] = React.useState(null);
    const [busy, setBusy] = React.useState(null);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState(null);
    const requestRef = React.useRef(0);
    const pollingRef = React.useRef(false);
    const sessionRef = React.useRef(sessionId);
    const selectedRef = React.useRef("");
    const queryRef = React.useRef("");
    const busyRef = React.useRef(false);
    const draftRef = React.useRef(null);
    const modelDirtyRef = React.useRef(false);
    const modelSelectionRef = React.useRef("");
    const researchDirtyRef = React.useRef(false);
    const researchRevisionRef = React.useRef(void 0);
    const noteViewUserRef = React.useRef(false);
    const noteViewRef = React.useRef("close-reading");
    const expandedRef = React.useRef(false);
    const confirmationRef = React.useRef(null);
    const pollingTicketRef = React.useRef(0);
    const [confirming, setConfirming] = React.useState(false);
    const [researchDirty, setResearchDirty] = React.useState(false);
    const [researchMode, setResearchMode] = React.useState(null);
    const [researchProtagonist, setResearchProtagonist] = React.useState("");
    const [researchOpeningPoint, setResearchOpeningPoint] = React.useState("");
    const [maxQueryBatches, setMaxQueryBatches] = React.useState("7");
    const [maxReadPackets, setMaxReadPackets] = React.useState("40");
    const modelSettingsRef = React.useRef(null);
    const focusedModelSettingsNonceRef = React.useRef(null);
    const [noteView, setNoteView] = React.useState("close-reading");
    sessionRef.current = sessionId;
    selectedRef.current = selectedId;
    modelSelectionRef.current = modelSelection;
    researchDirtyRef.current = researchDirty;
    noteViewRef.current = noteView;
    queryRef.current = query;
    draftRef.current = draft;
    const accept = React.useCallback((next, append) => {
      if (next.ok === false)
        throw Error(next.error ?? "\u8BFB\u53D6\u957F\u6587\u672C\u8D44\u6599\u5931\u8D25");
      setData((previous) => append && previous ? {
        ...next,
        notes: [...previous.notes, ...next.notes],
        researchNotes: next.researchNotes ? {
          ...next.researchNotes,
          entries: [
            ...previous.researchNotes?.entries ?? [],
            ...next.researchNotes.entries
          ]
        } : previous.researchNotes
      } : next);
      if (append)
        expandedRef.current = true;
      const resolved = next.selectedId ?? selectedRef.current ?? next.sources[0]?.sourceId ?? "";
      setSelectedId(resolved);
      selectedRef.current = resolved;
      if (!modelDirtyRef.current) {
        setModelSelection(next.defaultSemanticModelId ?? "");
        modelSelectionRef.current = next.defaultSemanticModelId ?? "";
      }
      setError(null);
      if (!researchDirtyRef.current && next.research) {
        setResearchMode(next.research.mode);
        setResearchProtagonist(next.research.target.protagonist);
        setResearchOpeningPoint(next.research.target.openingPoint);
        setMaxQueryBatches(String(next.research.budget.maxQueryBatches || 7));
        setMaxReadPackets(String(next.research.budget.maxReadPackets || 40));
      }
      researchRevisionRef.current = next.research?.revision;
      if (!noteViewUserRef.current && next.research?.mode) {
        setNoteView(next.research.mode);
        noteViewRef.current = next.research.mode;
      }
    }, []);
    const cancelPolling = () => {
      if (!pollingRef.current && !pollingTicketRef.current)
        return;
      pollingRef.current = false;
      pollingTicketRef.current = 0;
      setRefreshing(false);
    };
    const load = React.useCallback(async (options = {}) => {
      const silent = options.silent === true;
      if (silent ? pollingRef.current : busyRef.current)
        return;
      if (!silent)
        cancelPolling();
      const sourceId = options.sourceId ?? selectedRef.current;
      const activeQuery = options.query ?? queryRef.current;
      const ticket = ++requestRef.current;
      if (silent)
        pollingTicketRef.current = ticket;
      const params = new URLSearchParams({ sessionId });
      if (sourceId)
        params.set("sourceId", sourceId);
      if (options.cursor != null)
        params.set("cursor", String(options.cursor));
      if (activeQuery)
        params.set("query", activeQuery);
      params.set("noteMode", options.noteMode ?? noteViewRef.current);
      if (silent) {
        pollingRef.current = true;
        setRefreshing(true);
      } else {
        busyRef.current = true;
        setBusy("load");
      }
      setError(null);
      try {
        const next = await jsonFetch(`/api/roleplay/card-adaptation?${params.toString()}`);
        if (ticket !== requestRef.current || sessionRef.current !== sessionId)
          return;
        accept(next, options.append === true);
      } catch (e) {
        if (ticket === requestRef.current && sessionRef.current === sessionId)
          setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (silent && pollingTicketRef.current === ticket) {
          pollingRef.current = false;
          pollingTicketRef.current = 0;
          if (ticket === requestRef.current && sessionRef.current === sessionId)
            setRefreshing(false);
        } else if (ticket === requestRef.current && sessionRef.current === sessionId) {
          busyRef.current = false;
          setBusy(null);
        }
      }
    }, [accept, jsonFetch, sessionId]);
    React.useEffect(() => {
      requestRef.current++;
      sessionRef.current = sessionId;
      selectedRef.current = "";
      queryRef.current = "";
      busyRef.current = false;
      pollingRef.current = false;
      pollingTicketRef.current = 0;
      confirmationRef.current = null;
      draftRef.current = null;
      expandedRef.current = false;
      modelDirtyRef.current = false;
      modelSelectionRef.current = "";
      researchDirtyRef.current = false;
      researchRevisionRef.current = void 0;
      noteViewUserRef.current = false;
      noteViewRef.current = "close-reading";
      setData(null);
      setSelectedId("");
      setModelSelection("");
      setModelDirty(false);
      setQuery("");
      setQueryDraft("");
      setDraft(null);
      setEditingSegment(null);
      setBusy(null);
      setRefreshing(false);
      setConfirming(false);
      setError(null);
      setResearchDirty(false);
      setResearchMode(null);
      setResearchProtagonist("");
      setResearchOpeningPoint("");
      setMaxQueryBatches("7");
      setMaxReadPackets("40");
      setNoteView("close-reading");
      void load();
      return () => {
        requestRef.current++;
      };
    }, [load, sessionId]);
    React.useEffect(() => {
      const timer = window.setInterval(() => {
        if (!busyRef.current && !draftRef.current && !modelDirtyRef.current && !researchDirtyRef.current && !confirmationRef.current && !expandedRef.current)
          void load({ sourceId: selectedRef.current, query: queryRef.current, silent: true });
      }, 2500);
      return () => window.clearInterval(timer);
    }, [load]);
    React.useEffect(() => {
      if (!focusModelSettings || !data || !modelSettingsRef.current || focusedModelSettingsNonceRef.current === focusModelSettingsNonce)
        return;
      focusedModelSettingsNonceRef.current = focusModelSettingsNonce;
      modelSettingsRef.current.focus?.();
      modelSettingsRef.current.scrollIntoView?.({ block: "center" });
    }, [data, focusModelSettings, focusModelSettingsNonce]);
    React.useEffect(() => {
      if (data?.research?.mode === "coarse" && noteView === "coarse" && !data.researchNotes && !noteViewUserRef.current && !busyRef.current)
        void load({ sourceId: selectedRef.current, query: queryRef.current, noteMode: "coarse" });
    }, [data, load, noteView]);
    const mutate = React.useCallback(async (action, extra = {}, target) => {
      if (!data || busyRef.current && !target || sessionRef.current !== sessionId)
        return null;
      if (confirmationRef.current && !target)
        return null;
      cancelPolling();
      const targetSessionId = target?.sessionId ?? sessionId;
      const sourceIndependent = [
        "select-model",
        "attach-source",
        "delete-original",
        "auto-index-new-sources",
        "auto-rebuild-local-on-active"
      ].includes(action);
      const targetSourceId = sourceIndependent ? "" : target?.sourceId ?? (selectedRef.current || data.selectedId || "");
      const targetRevision = target?.expectedRevision ?? data.revision;
      const needsSource = !sourceIndependent;
      if (!targetSourceId && needsSource || targetSessionId !== sessionRef.current)
        return null;
      const ticket = ++requestRef.current;
      busyRef.current = true;
      setBusy(action);
      setError(null);
      try {
        const body = { sessionId: targetSessionId, action, ...extra };
        if (targetSourceId)
          body.sourceId = targetSourceId;
        if (action !== "select-model" && needsSource || targetSourceId)
          body.expectedRevision = targetRevision;
        if ([
          "attach-source",
          "publish-source",
          "detach-source",
          "delete-original",
          "clear-index",
          "rebuild-index",
          "resume-index"
        ].includes(action)) {
          body.expectedLibraryRevision = target?.expectedLibraryRevision ?? data.library?.revision ?? 0;
        }
        if (target?.assetId)
          body.assetId = target.assetId;
        if (action === "rebuild-index" || action === "resume-index")
          body.expectedModelRevision = target?.expectedModelRevision ?? data.modelRevision;
        if (action === "rebuild-index")
          body.indexFingerprint = target?.indexFingerprint ?? data.index?.fingerprint;
        if ([
          "research-mode",
          "research-budget",
          "research-pause",
          "research-resume"
        ].includes(action))
          body.expectedResearchRevision = target?.expectedResearchRevision ?? data.research?.revision ?? 0;
        const next = await jsonFetch("/api/roleplay/card-adaptation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
        if (ticket !== requestRef.current || sessionRef.current !== targetSessionId)
          return null;
        if (action === "select-model") {
          modelDirtyRef.current = false;
          setModelDirty(false);
        }
        accept(next, false);
        expandedRef.current = false;
        return next;
      } catch (e) {
        const error2 = e;
        if (error2?.code === "ADAPTATION_COARSE_MODEL_REQUIRED" || error2?.message?.includes("ADAPTATION_COARSE_MODEL_REQUIRED")) {
          const detail = {
            sessionId: targetSessionId,
            code: "ADAPTATION_COARSE_MODEL_REQUIRED",
            reason: error2.details?.reason,
            adaptationRevision: error2.details?.adaptationRevision,
            providerId: error2.details?.providerId,
            action: error2.details?.action ?? "configure-adaptation-model"
          };
          onNeedsConfig?.(detail);
          if (ticket === requestRef.current && sessionRef.current === targetSessionId)
            setError("\u7C97\u9897\u7C92\u5EA6\u6A21\u5F0F\u9700\u8981\u5148\u914D\u7F6E\u53EF\u7528\u7684\u5C0F\u8BF4\u4E13\u7528 Embedding \u6A21\u578B\u3002");
        } else if (ticket === requestRef.current && sessionRef.current === targetSessionId) {
          const message = String(e instanceof Error ? e.message : e);
          setError(message);
          toast(`\u957F\u6587\u672C\u8D44\u6599\u64CD\u4F5C\u5931\u8D25\uFF1A${message}`);
        }
        return null;
      } finally {
        if (ticket === requestRef.current && sessionRef.current === targetSessionId) {
          busyRef.current = false;
          setBusy(null);
        }
      }
    }, [accept, data, jsonFetch, sessionId, toast]);
    const selectSource = (sourceId) => {
      if (draftRef.current || modelDirtyRef.current)
        return;
      if (confirmationRef.current) {
        confirmationRef.current = null;
        requestRef.current++;
        setConfirming(false);
        busyRef.current = false;
        setBusy(null);
      }
      if (busyRef.current)
        return;
      expandedRef.current = false;
      noteViewUserRef.current = false;
      noteViewRef.current = "close-reading";
      setNoteView("close-reading");
      setSelectedId(sourceId);
      selectedRef.current = sourceId;
      setEditingSegment(null);
      setDraft(null);
      draftRef.current = null;
      void load({ sourceId, query: queryRef.current });
    };
    const search = () => {
      if (busyRef.current || draftRef.current || confirmationRef.current)
        return;
      expandedRef.current = false;
      const nextQuery = queryDraft.trim();
      setQuery(nextQuery);
      queryRef.current = nextQuery;
      void load({ sourceId: selectedRef.current, query: nextQuery });
    };
    const refreshNotes = () => {
      if (busyRef.current || draftRef.current || confirmationRef.current)
        return;
      expandedRef.current = false;
      void load({ sourceId: selectedRef.current, query: queryRef.current });
    };
    const semanticModels = data?.semanticModels ?? [];
    const selectModel = () => {
      if (!data || !modelDirtyRef.current || busyRef.current)
        return;
      if (modelSelectionRef.current && !semanticModels.some((item) => item.id === modelSelectionRef.current && item.ready))
        return;
      void mutate("select-model", { providerId: modelSelectionRef.current, expectedModelRevision: data.modelRevision });
    };
    const toggleAutoIndex = () => {
      if (!data || busyRef.current || confirmationRef.current)
        return;
      void mutate("auto-index-new-sources", { enabled: !data.autoIndexNewSources, expectedAutoIndexSettingsRevision: data.autoIndexSettingsRevision });
    };
    const toggleAutoRebuild = () => {
      if (!data || busyRef.current || confirmationRef.current)
        return;
      void mutate("auto-rebuild-local-on-active", { enabled: !data.autoRebuildLocalOnActive, expectedAutoIndexSettingsRevision: data.autoIndexSettingsRevision });
    };
    const startEdit = (note) => {
      if (busyRef.current || confirmationRef.current)
        return;
      cancelPolling();
      requestRef.current++;
      const next = noteDraft(note);
      setEditingSegment(note.segment);
      setDraft(next);
      draftRef.current = next;
    };
    const cancelEdit = () => {
      setEditingSegment(null);
      setDraft(null);
      draftRef.current = null;
    };
    const updateDraft = (key, value) => {
      if (!draft)
        return;
      const next = { ...draft, [key]: value };
      setDraft(next);
      draftRef.current = next;
    };
    const saveDraft = () => {
      if (!draft || busyRef.current)
        return;
      void mutate("save-note", {
        note: {
          segment: draft.segment,
          facts: draft.facts,
          implications: draft.implications,
          questions: draft.questions,
          evidence: draft.evidence
        }
      }).then((next) => {
        if (next)
          cancelEdit();
      });
    };
    const deleteNote = (segment) => {
      if (busyRef.current)
        return;
      void mutate("delete-note", { segment });
    };
    const confirmAction = (action, message, title, confirmLabel, after, extra = {}) => {
      if (!data || confirmationRef.current || busyRef.current || sessionRef.current !== sessionId)
        return;
      const sourceId = selectedRef.current || data.selectedId || data.sources[0]?.sourceId || "";
      const target = {
        sessionId,
        sourceId: sourceId || void 0,
        expectedRevision: data.revision,
        expectedModelRevision: data.modelRevision,
        expectedLibraryRevision: data.library?.revision ?? 0,
        expectedResearchRevision: data.research?.revision,
        indexFingerprint: data.index?.fingerprint,
        action
      };
      confirmationRef.current = target;
      setConfirming(true);
      busyRef.current = true;
      setBusy("confirm");
      void (async () => {
        try {
          const confirmed = await confirmWithDialog2(document, message, { title, confirmLabel });
          if (confirmed && confirmationRef.current === target && sessionRef.current === target.sessionId && (target.sourceId ? selectedRef.current === target.sourceId : true) && (target.expectedResearchRevision === void 0 || researchRevisionRef.current === target.expectedResearchRevision)) {
            const next = await mutate(action, extra, target);
            if (next)
              after?.();
          }
        } catch (e) {
          if (confirmationRef.current === target && sessionRef.current === target.sessionId)
            setError(String(e instanceof Error ? e.message : e));
        } finally {
          if (confirmationRef.current === target) {
            confirmationRef.current = null;
            busyRef.current = false;
            setConfirming(false);
            setBusy(null);
          }
        }
      })();
    };
    const markResearchDirty = () => {
      researchDirtyRef.current = true;
      setResearchDirty(true);
    };
    const chooseResearchMode = (mode) => {
      if (!data?.research || !source || !mode || busyRef.current || confirmationRef.current)
        return;
      if (mode === "coarse" && !researchProtagonist.trim()) {
        setError("\u7C97\u9897\u7C92\u5EA6\u6A21\u5F0F\u9700\u8981\u586B\u5199\u4E3B\u89D2\u540D\u3002");
        return;
      }
      const openingPoint = researchOpeningPoint.trim();
      confirmAction("research-mode", mode === "close-reading" ? "\u5207\u6362\u4E3A\u7CBE\u8BFB\u6A21\u5F0F\uFF1F\u5C06\u5B8C\u6574\u901A\u8BFB\u539F\u8457\uFF0C\u8017\u65F6\u548C\u8BF7\u6C42\u91CF\u8F83\u9AD8\u3002" : "\u5207\u6362\u4E3A\u7C97\u9897\u7C92\u5EA6\u6A21\u5F0F\uFF1F\u5C06\u5B9A\u5411\u68C0\u7D22\u8BC1\u636E\u5E76\u5206\u5C42\u62BD\u67E5\uFF0C\u4E0D\u80FD\u58F0\u79F0\u8BFB\u5B8C\u6574\u672C\u539F\u8457\u3002", "\u9605\u8BFB\u4E0E\u6539\u7F16\u6A21\u5F0F", "\u786E\u8BA4\u5207\u6362", () => {
        researchDirtyRef.current = false;
        setResearchDirty(false);
      }, { readingMode: mode, protagonist: researchProtagonist.trim(), openingPoint });
    };
    const saveResearchBudget = () => {
      if (!data?.research || busyRef.current || confirmationRef.current)
        return;
      const queryLimit = Math.max(1, Math.min(200, Number(maxQueryBatches) || 7));
      const readLimit = Math.max(1, Math.min(500, Number(maxReadPackets) || 40));
      void mutate("research-budget", { maxQueryBatches: queryLimit, maxReadPackets: readLimit }, {
        sessionId,
        sourceId: selectedRef.current || data.selectedId || void 0,
        expectedRevision: data.revision,
        expectedModelRevision: data.modelRevision,
        expectedLibraryRevision: data.library?.revision ?? 0,
        expectedResearchRevision: data.research.revision
      }).then((next) => {
        if (next) {
          researchDirtyRef.current = false;
          setResearchDirty(false);
        }
      });
    };
    const toggleResearchPause = () => {
      if (!data?.research || busyRef.current || confirmationRef.current)
        return;
      const action = data.research.status === "paused" ? "research-resume" : "research-pause";
      void mutate(action, {}, {
        sessionId,
        sourceId: selectedRef.current || data.selectedId || void 0,
        expectedRevision: data.revision,
        expectedModelRevision: data.modelRevision,
        expectedLibraryRevision: data.library?.revision ?? 0,
        expectedResearchRevision: data.research.revision
      });
    };
    const clearNotes = () => confirmAction("clear-notes", "\u6E05\u7A7A\u5F53\u524D\u5C0F\u8BF4\u539F\u6587\u7684\u5168\u90E8\u7814\u7A76\u7B14\u8BB0\uFF1F\u6E05\u7A7A\u540E\u4ECD\u53EF\u91CD\u65B0\u9605\u8BFB\u539F\u6587\u5E76\u518D\u6B21\u6574\u7406\u3002", "\u6E05\u7A7A\u7814\u7A76\u7B14\u8BB0", "\u6E05\u7A7A", cancelEdit);
    const indexAction = (action) => {
      const references = data?.shared?.references ?? 1;
      const message = action === "rebuild-index" ? `\u91CD\u5EFA\u5F53\u524D\u5C0F\u8BF4\u539F\u6587\u7684\u5411\u91CF\u7D22\u5F15\uFF1F\u5C06\u91CD\u65B0\u7F16\u7801\u539F\u6587\uFF0C\u53EF\u80FD\u4EA7\u751F\u5D4C\u5165\u8D39\u7528\uFF1B\u5DF2\u6709\u9605\u8BFB\u7B14\u8BB0\u4FDD\u7559\u3002${references > 1 ? `\u8FD9\u4F1A\u5F71\u54CD ${references} \u4E2A\u5BF9\u8BDD\u7684\u5171\u4EAB\u7D22\u5F15\u3002` : ""}` : action === "clear-index" ? `\u6E05\u7A7A\u5F53\u524D\u5C0F\u8BF4\u539F\u6587\u7684\u5411\u91CF\u7D22\u5F15\uFF1F\u5C0F\u8BF4\u539F\u6587\u548C\u7814\u7A76\u7B14\u8BB0\u4F1A\u4FDD\u7559\u3002${references > 1 ? `\u8FD9\u4F1A\u5F71\u54CD ${references} \u4E2A\u5BF9\u8BDD\u7684\u5171\u4EAB\u7D22\u5F15\u3002` : ""}` : `\u8865\u9F50\u7F3A\u5C11\u6216\u91CD\u8BD5\u5931\u8D25\u7684\u5411\u91CF\uFF1F\u5DF2\u6709\u6210\u529F\u5411\u91CF\u4F1A\u4FDD\u7559\uFF0C\u53EA\u5904\u7406\u7F3A\u5931\u3001\u5931\u8D25\u6216\u672A\u77E5\u7ED3\u679C\uFF0C\u53EF\u80FD\u4EA7\u751F\u5D4C\u5165\u8D39\u7528\u3002${references > 1 ? `\u8FD9\u4F1A\u5F71\u54CD ${references} \u4E2A\u5BF9\u8BDD\u7684\u5171\u4EAB\u7D22\u5F15\u3002` : ""}`;
      const title = action === "rebuild-index" ? "\u91CD\u5EFA\u5411\u91CF\u7D22\u5F15" : action === "clear-index" ? "\u6E05\u7A7A\u5411\u91CF\u7D22\u5F15" : "\u8865\u9F50\u5411\u91CF\u7D22\u5F15";
      const confirmLabel = action === "rebuild-index" ? "\u91CD\u5EFA" : action === "clear-index" ? "\u6E05\u7A7A" : "\u5F00\u59CB\u8865\u9F50";
      confirmAction(action, message, title, confirmLabel);
    };
    const libraryMutation = (action, assetId) => {
      if (!data || busyRef.current || confirmationRef.current)
        return;
      const sourceId = action === "attach-source" || action === "delete-original" ? "" : selectedRef.current || data.selectedId || data.sources[0]?.sourceId || "";
      if (!sourceId && action !== "attach-source" && action !== "delete-original")
        return;
      const target = {
        sessionId,
        sourceId,
        assetId,
        expectedRevision: data.revision,
        expectedModelRevision: data.modelRevision,
        expectedLibraryRevision: data.library?.revision ?? 0,
        indexFingerprint: data.index?.fingerprint
      };
      if (action === "delete-original") {
        const asset = data.library?.assets.find((item) => item.assetId === assetId);
        if (!asset || asset.references > 0)
          return;
        confirmationRef.current = { ...target, action };
        setConfirming(true);
        busyRef.current = true;
        setBusy("confirm");
        void (async () => {
          try {
            const confirmed = await confirmWithDialog2(document, `\u5220\u9664\u5171\u4EAB\u539F\u8457\u201C${asset.name}\u201D\uFF1F\u6B64\u6761\u76EE\u6CA1\u6709\u5BF9\u8BDD\u5F15\u7528\u3002`, { title: "\u5220\u9664\u5171\u4EAB\u539F\u8457", confirmLabel: "\u5220\u9664" });
            if (confirmed && confirmationRef.current?.action === action && sessionRef.current === sessionId)
              await mutate(action, {}, target);
          } finally {
            if (confirmationRef.current?.action === action) {
              confirmationRef.current = null;
              busyRef.current = false;
              setConfirming(false);
              setBusy(null);
            }
          }
        })();
        return;
      }
      void mutate(action, assetId ? { assetId } : {}, target);
    };
    const source = data?.sources.find((item) => item.sourceId === selectedId) ?? data?.sources[0];
    const hasSources = !!data && data.sources.length > 0;
    const changeNoteView = (mode) => {
      if (mode === noteView || busyRef.current || draftRef.current || confirmationRef.current)
        return;
      cancelPolling();
      requestRef.current++;
      expandedRef.current = false;
      noteViewUserRef.current = true;
      setNoteView(mode);
      noteViewRef.current = mode;
      void load({ sourceId: selectedRef.current, query: queryRef.current, noteMode: mode });
    };
    const changeModelSelection = (value) => {
      setModelSelection(value);
      modelSelectionRef.current = value;
      const dirty = value !== (data?.defaultSemanticModelId ?? "");
      modelDirtyRef.current = dirty;
      setModelDirty(dirty);
    };
    const loadMoreNotes = (noteMode) => {
      const cursor = noteMode === "coarse" ? data?.researchNotes?.nextCursor : data?.nextCursor;
      void load({ sourceId: selectedId, query, cursor, noteMode, append: true });
    };
    const { libraryCard, semanticCard, sourceCard, indexCard } = renderSourceCards({
      data,
      source,
      hasSources,
      busy,
      confirming,
      draft,
      modelSelection,
      modelDirty,
      modelSettingsRef,
      changeModelSelection,
      selectModel,
      selectSource,
      toggleAutoIndex,
      toggleAutoRebuild,
      libraryMutation,
      indexAction,
      pauseIndex: () => void mutate("pause-index")
    });
    const { researchCard, notesCard } = renderResearchCards({
      data,
      source,
      hasSources,
      busy,
      confirming,
      draft,
      researchMode,
      researchProtagonist,
      researchOpeningPoint,
      researchDirty,
      maxQueryBatches,
      maxReadPackets,
      noteView,
      queryDraft,
      editingSegment,
      refreshing,
      setResearchMode,
      setResearchProtagonist,
      setResearchOpeningPoint,
      setMaxQueryBatches,
      setMaxReadPackets,
      markResearchDirty,
      chooseResearchMode,
      saveResearchBudget,
      toggleResearchPause,
      changeNoteView,
      setQueryDraft,
      search,
      refreshNotes,
      clearNotes,
      updateDraft,
      saveDraft,
      cancelEdit,
      startEdit,
      deleteNote,
      loadMoreNotes
    });
    return h("section", { className: "dsh-rp-panel dsh-rp-adaptation", "aria-label": "\u957F\u6587\u672C\u8F6C\u89D2\u8272\u5361" }, error ? h("div", { role: "alert", className: "dsh-rp-error" }, error) : null, libraryCard, semanticCard, sourceCard, hasSources ? researchCard : null, hasSources ? notesCard : null, hasSources ? indexCard : null);
  };
}

// reader-beauty.js
function createReaderBeautyCache({ renderAsync = renderReaderNarrativeAsync, renderSync = renderReaderNarrative } = {}) {
  const cache = /* @__PURE__ */ new Map();
  let currentScope = "";
  function selectScope(scope) {
    if (currentScope !== scope) {
      cache.clear();
      currentScope = scope;
    }
  }
  function run(scope, tasks, rules, changed) {
    if (!rules.length)
      return;
    let cancelled = false;
    function runBeautyRegex(task) {
      if (cancelled)
        throw new Error("cancelled");
      return runReaderRegex(task);
    }
    void (async () => {
      for (const raw of tasks) {
        if (cancelled)
          break;
        if (cache.has(raw))
          continue;
        let value;
        try {
          value = { html: await renderAsync(raw, rules, runBeautyRegex) };
        } catch (error) {
          value = {
            html: renderSync(raw, []),
            error: String(error && typeof error === "object" && "message" in error ? error.message : error)
          };
        }
        if (cancelled || currentScope !== scope)
          break;
        cache.set(raw, value);
        while (cache.size > 500)
          cache.delete(cache.keys().next().value);
        changed();
      }
    })();
    return () => {
      cancelled = true;
    };
  }
  const htmlFor = (raw) => cache.get(raw)?.html ?? renderSync(raw, []);
  const failed = (tasks) => tasks.some((raw) => cache.get(raw)?.error);
  return { selectScope, run, htmlFor, failed };
}

// author-runtime.js
function createAuthorRuntime(root, fill) {
  const registrations = [];
  const timers = /* @__PURE__ */ new Set();
  const add = (type, handler, options) => {
    if (typeof type !== "string" || !handler)
      return;
    const registration = {
      type,
      handler,
      options
    };
    registrations.push(registration);
    root.addEventListener(registration.type, registration.handler, registration.options);
  };
  const remove = (type, handler, options) => {
    const index = registrations.findIndex((item) => item.type === type && item.handler === handler);
    if (index >= 0)
      registrations.splice(index, 1);
    if (typeof type === "string" && handler)
      root.removeEventListener(type, handler, options);
  };
  const clock = (name) => name === "setTimeout" || name === "setInterval" ? (callback, delay) => {
    if (typeof callback !== "function")
      return 0;
    const id = name === "setTimeout" ? setTimeout(callback, delay) : setInterval(callback, delay);
    const numeric = Number(id);
    timers.add(numeric);
    return numeric;
  } : (id) => {
    const numeric = Number(id);
    timers.delete(numeric);
    if (name === "clearTimeout")
      clearTimeout(numeric);
    else
      clearInterval(numeric);
  };
  let windowFace;
  const face = (target) => new Proxy(target, {
    get(inner, key) {
      if (typeof key !== "string")
        return Reflect.get(inner, key, inner);
      if (key === "addEventListener")
        return add;
      if (key === "removeEventListener")
        return remove;
      if (key === "setTimeout" || key === "setInterval" || key === "clearTimeout" || key === "clearInterval")
        return clock(key);
      if (key === "document")
        return documentFace;
      if (key === "window" || key === "self" || key === "globalThis" || key === "top" || key === "parent")
        return windowFace ?? inner;
      const value = Reflect.get(inner, key, inner);
      return typeof value === "function" ? value.bind(inner) : value;
    }
  });
  const documentFace = face(document);
  windowFace = face(window);
  const timeout = clock("setTimeout"), interval = clock("setInterval");
  const args = [
    root,
    fill,
    documentFace,
    windowFace,
    windowFace,
    windowFace,
    windowFace,
    windowFace,
    timeout,
    interval,
    clock("clearTimeout"),
    clock("clearInterval")
  ];
  return {
    run: (source) => {
      const author = new Function("root", "fill", "document", "window", "globalThis", "self", "top", "parent", "setTimeout", "setInterval", "clearTimeout", "clearInterval", source);
      const result = author.call(windowFace, ...args);
      return typeof result === "function" ? result : null;
    },
    teardown: () => {
      for (const registration of registrations.splice(0)) {
        try {
          root.removeEventListener(registration.type, registration.handler, registration.options);
        } catch {
        }
      }
      for (const id of timers) {
        clearTimeout(id);
        clearInterval(id);
      }
      timers.clear();
    }
  };
}

// reader-view.js
function createReaderView({ React, resolveActiveSessionId, isRoleplaySession, useTavernActivity, fetchState, sessionsService, toast, UserActions, AssistantActions, actionIconButton, ICONS, pendingPlayerBubble, ActivityBanner, ACTIVITY_CSS: ACTIVITY_CSS2 }) {
  const noopSnapshotHook = () => null;
  function ReaderView(props) {
    const sessionId = props.sessionId ?? props.scope?.sessionId ?? null;
    React.useEffect(() => {
      const restore = () => window.dispatchEvent(new Event("dsh-roleplay-view-activated"));
      restore();
      return () => {
        restore();
      };
    }, [sessionId]);
    const [state, setState] = React.useState(null);
    const [loadError, setLoadError] = React.useState(null);
    const [readerStart, setReaderStart] = React.useState(null);
    const [loadingOlder, setLoadingOlder] = React.useState(false);
    const [historyError, setHistoryError] = React.useState(null);
    const activity = useTavernActivity(sessionId, state?.activity);
    const [, refreshBeauty] = React.useState(0);
    const beautyCacheRef = React.useRef(null);
    beautyCacheRef.current ??= createReaderBeautyCache();
    const historyRequestRef = React.useRef(null);
    const historyAnchorRef = React.useRef(null);
    const readerSessionRef = React.useRef(sessionId);
    const streamLeaseRef = React.useRef(null);
    readerSessionRef.current = sessionId;
    if (streamLeaseRef.current?.sessionId !== sessionId)
      streamLeaseRef.current = null;
    React.useEffect(() => {
      setState(null);
      setLoadError(null);
      setReaderStart(null);
      setLoadingOlder(false);
      setHistoryError(null);
      historyRequestRef.current = null;
      historyAnchorRef.current = null;
      if (!sessionId)
        return;
      if (!isRoleplaySession(sessionId))
        return;
      let alive = true;
      const requestedSessionId = sessionId;
      const load = () => {
        if (typeof document !== "undefined" && document.hidden)
          return;
        fetchState(requestedSessionId, true).then((d) => {
          if (!alive)
            return;
          if (d?.sessionId && d.sessionId !== requestedSessionId)
            return;
          setLoadError(d?.ok === false ? String(d.error ?? "\u89D2\u8272\u626E\u6F14\u72B6\u6001\u4E0D\u53EF\u7528") : null);
          setState(d);
        }).catch((error) => {
          if (alive)
            setLoadError(String(error && typeof error === "object" && "message" in error ? error.message : error));
        });
      };
      load();
      const timer = setInterval(load, 3e4);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [sessionId]);
    React.useEffect(() => {
      if (!sessionId || !activity)
        return;
      let alive = true;
      fetchState(sessionId, true).then((data) => {
        if (alive && data?.sessionId === sessionId) {
          setState(data);
          setLoadError(null);
        }
      }).catch(() => {
      });
      return () => {
        alive = false;
      };
    }, [sessionId, activity?.storySeq, activity?.stage]);
    const useChat = typeof props.useChat === "function" ? props.useChat : noopSnapshotHook;
    const chat = useChat((value) => value);
    const useConv = typeof props.useConversation === "function" ? props.useConversation : noopSnapshotHook;
    const snapshot = useConv((value) => value) ?? props.snapshot ?? props.conversation ?? null;
    const readerRef = React.useRef(null);
    const scrollRef = React.useRef(null);
    const useSession = props.useSession ?? noopSnapshotHook;
    const historySnapshot = useSession((value) => value);
    const loadOlder = sessionId ? () => sessionsService.using(sessionId, { source: "nexttavernReader" }, (reference) => reference.binding.session.loadOlder()) : null;
    const fillComposer = (text) => {
      const editor = document.querySelector("[data-composer-input]");
      if (editor) {
        try {
          editor.focus();
          const sel = window.getSelection();
          if (sel && typeof sel.removeAllRanges === "function") {
            sel.removeAllRanges();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            sel.addRange(range);
          }
          if (document.execCommand("insertText", false, text)) {
            toast("\u5DF2\u586B\u5165\u8F93\u5165\u6846");
            return;
          }
        } catch {
        }
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => toast("\u8F93\u5165\u6846\u4E0D\u53EF\u8FBE\uFF0C\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F")).catch(() => {
        });
      }
    };
    const beauty = state?.rules?.beauty ?? null;
    const rules = Array.isArray(beauty?.regexRules) ? beauty.regexRules : [];
    const authorCss = String(beauty?.css ?? "");
    const authorJs = String(beauty?.js ?? "");
    const parts = [];
    const nodes = Array.isArray(chat?.order) && chat?.nodes && typeof chat.nodes.get === "function" ? chat.order.map((key) => chat.nodes.get(key)).filter((node) => !!node && node.visibility !== "hidden") : normalizeConversationNodes(snapshot).filter((node) => node && node.visibility !== "hidden");
    const surfaceSeqs = new Set((state?.surfaceNodes ?? []).map((entry) => Number(entry?.seq)).filter(Number.isSafeInteger));
    const turnMetaByMessageId = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      if (node?.kind !== "turn-tail")
        continue;
      const messageId = String(node.data?.closing?.finalNode?.messageId ?? "");
      if (!messageId)
        continue;
      const startTime = Number(node.location?.turn?.start?.time);
      const endTime = Number(node.location?.turn?.end?.time);
      turnMetaByMessageId.set(messageId, {
        usage: node.data?.tokenUsage,
        runMs: Number.isFinite(startTime) && Number.isFinite(endTime) ? Math.max(0, endTime - startTime) : null,
        tokensPerSecond: Number(node.data?.tokensPerSecond)
      });
    }
    const selectedNodeSeqs = /* @__PURE__ */ new Set();
    const selectedNodes = nodes.filter((node) => {
      const kind = String(node?.kind ?? "");
      if (!["user", "assistant-step", "assistant", "narrator"].includes(kind))
        return false;
      if (kind === "assistant-step" && node?.data?.status && node.data.status !== "settled")
        return false;
      const seq = readerNodeSeq(node);
      if (seq === null || !surfaceSeqs.has(seq) || selectedNodeSeqs.has(seq))
        return false;
      selectedNodeSeqs.add(seq);
      return true;
    });
    const windowStart = readerStart === null ? Math.max(0, selectedNodes.length - 500) : Math.min(Math.max(0, readerStart), Math.max(0, selectedNodes.length - 1));
    const readerNodes = selectedNodes.slice(windowStart);
    const settledStoryKeys = new Set(readerNodes.filter((node) => node?.kind === "assistant-step" && node?.data?.status === "settled").map((node) => `${node.data?.turn ?? ""}:${node.data?.step ?? ""}`));
    const failedTurnByUserSeq = /* @__PURE__ */ new Map();
    if (!(activity?.sessionId === sessionId && activity.running === true)) {
      for (const [turnKey, recoverySeq] of Object.entries(state?.failedTurnRecoveryByTurn ?? {})) {
        const turn = Number(turnKey);
        if (!Number.isSafeInteger(turn) || turn < 0 || typeof recoverySeq !== "number" || !Number.isSafeInteger(recoverySeq) || recoverySeq < 0)
          continue;
        failedTurnByUserSeq.set(recoverySeq, turn);
      }
    }
    for (const node of readerNodes) {
      if (!node || typeof node !== "object")
        continue;
      const text = readerText(node);
      if (!text)
        continue;
      const seq = readerNodeSeq(node);
      const messageId = readerMessageId(node);
      if (node.kind === "user") {
        parts.push({ kind: "user", text, seq, time: readerTime(node), failedTurn: failedTurnByUserSeq.get(seq) });
      } else if (node.kind === "assistant-step" || node.kind === "assistant" || node.kind === "narrator") {
        parts.push({
          kind: "narrator",
          text,
          seq,
          messageId,
          time: readerTime(node),
          usage: node.data?.usage,
          turnMeta: turnMetaByMessageId.get(messageId) ?? null
        });
      }
    }
    if (streamLeaseRef.current && (streamLeaseRef.current.sessionId !== sessionId || activity?.sessionId === sessionId && Number.isSafeInteger(activity.turn) && activity.turn !== streamLeaseRef.current.turn))
      streamLeaseRef.current = null;
    if (sessionId && activity?.sessionId === sessionId && activity.running && activity.stage === "story" && typeof activity.turn === "number" && Number.isSafeInteger(activity.turn) && typeof activity.storyStep === "number" && Number.isSafeInteger(activity.storyStep)) {
      streamLeaseRef.current = { sessionId, turn: activity.turn, step: activity.storyStep };
    }
    const streamLease = streamLeaseRef.current;
    if (streamLease?.sessionId === sessionId) {
      const streamTurn = streamLease.turn;
      const streamStep = streamLease.step;
      const streamKey = `${streamTurn}:${streamStep}`;
      if (settledStoryKeys.has(streamKey))
        streamLeaseRef.current = null;
      if (!settledStoryKeys.has(streamKey)) {
        const candidates = [];
        for (const node of nodes) {
          if (node?.kind !== "assistant-step" || !["running", "settled"].some((status) => status === node?.data?.status))
            continue;
          if (node.data?.turn !== streamTurn || node.data?.step !== streamStep)
            continue;
          const blocks = node.data?.blocks;
          const text = Array.isArray(blocks) ? blocks.filter((block) => block?.kind === "text" && typeof block.text === "string").map((block) => block.text).filter(Boolean).join("\n") : "";
          if (text)
            candidates.push({ node, text });
        }
        const candidate = candidates.find((item) => item.node.data?.status === "settled") ?? candidates[0];
        if (candidate) {
          parts.push({
            kind: "narrator",
            text: candidate.text,
            time: readerTime(candidate.node),
            transient: true,
            streamKey: `stream:${streamTurn}:${streamStep}`
          });
        }
      }
    }
    const beautyScope = sessionId + "\0" + JSON.stringify(rules);
    const beautyCache = beautyCacheRef.current;
    beautyCache.selectScope(beautyScope);
    const beautyTasks = parts.filter((part) => part.kind === "narrator" && !part.transient).map((part) => part.text);
    const beautyInput = JSON.stringify(beautyTasks);
    React.useEffect(() => beautyCache.run(beautyScope, beautyTasks, rules, () => refreshBeauty((n) => n + 1)), [beautyScope, beautyInput]);
    const applyBeauty = beautyCache.htmlFor;
    const beautyFailed = beautyCache.failed(beautyTasks);
    const renderedParts = parts.map((part) => ({
      ...part,
      html: part.kind === "narrator" ? applyBeauty(part.text) : ""
    }));
    if (state !== null && selectedNodes.length === 0) {
      console.warn("[roleplay-reader] selected surface empty", {
        sessionId,
        allNodeCount: nodes.length,
        surfaceSeqs: [...surfaceSeqs].slice(-12),
        snapshotType: typeof snapshot,
        snapshotKeys: snapshot && typeof snapshot === "object" ? Object.keys(snapshot).slice(0, 12) : null
      });
    }
    const docHtml = renderedParts.map((part) => part.kind === "narrator" ? part.html : part.text).join("\n");
    const committedDocHtml = renderedParts.filter((part) => !part.transient).map((part) => part.kind === "narrator" ? part.html : part.text).join("\n");
    const historyBusy = loadingOlder || historySnapshot?.loadingOlder === true;
    const canLoadOlder = windowStart > 0 || !!loadOlder && historySnapshot?.hasMore === true;
    const readerPartKey = (part) => part.transient ? part.streamKey : `${part.kind}:${part.seq ?? ""}:${part.messageId ?? ""}`;
    const renderedHeadKey = renderedParts.length ? readerPartKey(renderedParts[0]) : null;
    React.useLayoutEffect(() => {
      const held = historyAnchorRef.current;
      const scroller = scrollRef.current;
      if (!held || !scroller || held.sessionId !== sessionId)
        return;
      if (held.headKey === renderedHeadKey && held.count === renderedParts.length)
        return;
      const row = Array.from(scroller.querySelectorAll("[data-reader-key]")).find((element) => element.getAttribute("data-reader-key") === held.key);
      if (row)
        scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - held.top;
      historyAnchorRef.current = null;
    }, [docHtml, renderedHeadKey, renderedParts.length, sessionId]);
    const requestOlder = async () => {
      if (!canLoadOlder || historyBusy || historyRequestRef.current)
        return;
      const requestedSessionId = sessionId;
      const request = {};
      historyRequestRef.current = request;
      setHistoryError(null);
      const scroller = scrollRef.current;
      const viewportTop = scroller?.getBoundingClientRect().top ?? 0;
      const anchor = scroller && Array.from(scroller.querySelectorAll("[data-reader-key]")).find((element) => element.getBoundingClientRect().bottom > viewportTop + 1);
      historyAnchorRef.current = anchor ? {
        sessionId,
        key: anchor.getAttribute("data-reader-key"),
        top: anchor.getBoundingClientRect().top - viewportTop,
        headKey: renderedHeadKey,
        count: renderedParts.length
      } : null;
      setLoadingOlder(true);
      try {
        if (windowStart > 0) {
          setReaderStart(Math.max(0, windowStart - 500));
        } else {
          setReaderStart(0);
          await loadOlder?.();
        }
      } catch (error) {
        if (readerSessionRef.current !== requestedSessionId)
          return;
        historyAnchorRef.current = null;
        setHistoryError(String(error && typeof error === "object" && "message" in error ? error.message : error));
      } finally {
        if (historyRequestRef.current === request) {
          historyRequestRef.current = null;
          setLoadingOlder(false);
        }
      }
    };
    const scopedCss = "@layer dsh-roleplay-reader-default {\n" + scopeReaderCss(READER_BASE_CSS) + "\n}\n" + scopeReaderCss(authorCss);
    React.useEffect(() => {
      const el = readerRef.current;
      if (!el || !sessionId || !isRoleplaySession(sessionId) || state?.sessionId !== sessionId || state?.preset !== "roleplay")
        return;
      const runtime = createAuthorRuntime(el, fillComposer);
      let cleanup = null;
      if (authorJs.trim()) {
        try {
          cleanup = runtime.run(authorJs);
        } catch (err) {
          console.warn("[roleplay-reader] author js failed:", err);
        }
      }
      return () => {
        try {
          cleanup?.();
        } catch (err) {
          console.warn("[roleplay-reader] author js cleanup failed:", err);
        }
        runtime.teardown();
      };
    }, [committedDocHtml, authorJs, sessionId, state?.sessionId, state?.preset]);
    if (!sessionId)
      return null;
    if (state === null) {
      return React.createElement("div", { className: "rp-reader-view" }, React.createElement("div", { className: "rp-reader-empty" }, "\u6B63\u5728\u52A0\u8F7D\u9605\u8BFB\u89C6\u56FE\u2026"));
    }
    if (state.sessionId !== sessionId || state.preset !== "roleplay") {
      return React.createElement("div", { className: "rp-reader-view" }, React.createElement("div", { className: "rp-reader-empty" }, "\u300C\u9605\u8BFB\u300D\u89C6\u56FE\u4EC5\u5728\u89D2\u8272\u626E\u6F14\u4F1A\u8BDD\u4E2D\u53EF\u7528"));
    }
    const copyReaderText = async (text) => {
      try {
        await navigator.clipboard.writeText(String(text ?? ""));
        toast("\u5DF2\u590D\u5236");
      } catch {
        toast("\u590D\u5236\u5931\u8D25");
      }
    };
    const renderReaderActions = (part) => {
      if (part.transient)
        return null;
      const extensionActions = part.kind === "user" ? Number.isSafeInteger(part.failedTurn) ? React.createElement(AssistantActions, { sessionId, messageId: void 0, turn: part.failedTurn, text: part.text }) : React.createElement(UserActions, { sessionId, seq: part.seq, text: part.text }) : React.createElement(AssistantActions, { sessionId, messageId: part.messageId, text: part.text });
      const usage = usageTokens(part.turnMeta?.usage ?? part.usage);
      const meta = [
        usage !== null ? `\u7528\u91CF ${usage.toLocaleString()} tok` : "",
        Number.isFinite(part.turnMeta?.runMs) ? `\u7528\u65F6 ${(part.turnMeta.runMs / 1e3).toFixed(1)} \u79D2` : "",
        Number.isFinite(part.turnMeta?.tokensPerSecond) ? `${part.turnMeta.tokensPerSecond.toFixed(1)} tok/s` : "",
        formatReaderTime(part.time)
      ].filter(Boolean).join(" \xB7 ");
      return React.createElement("div", { className: "rp-reader-actions" }, actionIconButton("\u590D\u5236", ICONS.copy, () => copyReaderText(part.text)), extensionActions, meta ? React.createElement("span", { className: "rp-reader-meta" }, meta) : null);
    };
    return React.createElement("div", {
      className: "rp-reader-view",
      ref: scrollRef,
      onScroll: (event) => {
        if (event.currentTarget.scrollTop < 140 && !historyError)
          void requestOlder();
      },
      onWheel: (event) => {
        if (event.deltaY < 0 && event.currentTarget.scrollTop < 140 && !historyError)
          void requestOlder();
      }
    }, React.createElement("style", null, scopedCss + ACTIVITY_CSS2), beautyFailed ? React.createElement("div", { className: "rp-reader-empty", role: "status" }, "\u90E8\u5206\u7F8E\u5316\u89C4\u5219\u672A\u80FD\u5B89\u5168\u5B8C\u6210\uFF0C\u5DF2\u4FDD\u7559\u5B8C\u6574\u6B63\u6587\u3002\u4FEE\u6539\u89C4\u5219\u540E\u4F1A\u91CD\u65B0\u5339\u914D\u3002") : null, canLoadOlder || historyBusy || historyError ? React.createElement("div", { className: "rp-reader-history", role: "status", "aria-live": "polite" }, React.createElement("button", { type: "button", className: "rp-reader-load-older", onClick: requestOlder, disabled: historyBusy }, historyBusy ? React.createElement("span", { className: "rp-reader-spinner", "aria-hidden": "true" }) : null, historyBusy ? "\u6B63\u5728\u52A0\u8F7D\u66F4\u65E9\u5267\u60C5\u2026" : historyError ? "\u52A0\u8F7D\u5931\u8D25\uFF0C\u70B9\u51FB\u91CD\u8BD5" : "\u52A0\u8F7D\u66F4\u65E9\u5267\u60C5")) : null, loadError ? React.createElement("div", { className: "rp-reader-empty" }, "\u9605\u8BFB\u5668\u52A0\u8F7D\u5931\u8D25\uFF1A" + loadError) : null, !loadError && state !== null && selectedNodes.length === 0 ? React.createElement("div", { className: "rp-reader-empty" }, "\u6682\u65E0\u53EF\u9605\u8BFB\u7684\u6B63\u6587") : null, React.createElement("div", {
      className: "rp-reader",
      ref: readerRef,
      onClick: (event) => {
        const f = event.target && typeof event.target.closest === "function" ? event.target.closest(".f") : null;
        if (f) {
          event.preventDefault();
          event.stopPropagation();
          fillComposer(f.innerText || f.textContent || "");
        }
      }
    }, renderedParts.map((part, index) => React.createElement("section", {
      className: "rp-reader-message",
      "data-kind": part.kind === "user" ? "user" : "assistant",
      "data-reader-key": readerPartKey(part),
      key: `${part.kind}:${part.seq ?? index}:${part.messageId ?? ""}`
    }, part.kind === "user" ? React.createElement("p", { className: "rp-user-line" }, "\u25C8 \u4F60\uFF1A" + part.text) : React.createElement("div", { className: "rp-reader-narrative", dangerouslySetInnerHTML: { __html: part.html } }), renderReaderActions(part)))), pendingPlayerBubble(activity, nodes), React.createElement(ActivityBanner, { activity }));
  }
  return ReaderView;
}

// decision-seat.js
function createDecisionSeat({ React, createRoot, resolveActiveSessionId, toast }) {
  function DecisionCard({ decision, decisionMinimized, onMinimize, onDismiss, fillInput, renderText }) {
    const cardRef = React.useRef(null), dragRef = React.useRef(null), offsetRef = React.useRef({
      x: 0,
      y: 0
    });
    const [offset, setOffset] = React.useState({ x: 0, y: 0 });
    const [viewportHeight, setViewportHeight] = React.useState(window.visualViewport?.height ?? window.innerHeight);
    const moveTo = (next) => {
      offsetRef.current = next;
      setOffset(next);
    };
    const keepVisible = (next) => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect)
        return next;
      const baseX = rect.left - offsetRef.current.x, baseY = rect.top - offsetRef.current.y;
      const view = window.visualViewport, left = view?.offsetLeft ?? 0, top = view?.offsetTop ?? 0;
      const width = view?.width ?? window.innerWidth, height = view?.height ?? window.innerHeight;
      return {
        x: Math.min(Math.max(next.x, left + 8 - baseX), left + Math.max(8, width - rect.width - 8) - baseX),
        y: Math.min(Math.max(next.y, top + 8 - baseY), top + Math.max(8, height - rect.height - 8) - baseY)
      };
    };
    const reclamp = () => {
      const next = keepVisible(offsetRef.current);
      if (next.x !== offsetRef.current.x || next.y !== offsetRef.current.y)
        moveTo(next);
    };
    React.useLayoutEffect(reclamp, [decisionMinimized, viewportHeight]);
    React.useEffect(() => {
      const view = window.visualViewport;
      const resize = () => {
        setViewportHeight(view?.height ?? window.innerHeight);
        reclamp();
      };
      window.addEventListener("resize", resize);
      view?.addEventListener("resize", resize);
      view?.addEventListener("scroll", resize);
      return () => {
        window.removeEventListener("resize", resize);
        view?.removeEventListener("resize", resize);
        view?.removeEventListener("scroll", resize);
      };
    }, []);
    const startDrag = (e) => {
      if (e.button !== 0 || e.target?.closest?.("button,input") || e.isPrimary === false)
        return;
      e.preventDefault();
      dragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, offset: offsetRef.current };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const moveDrag = (e) => {
      const drag = dragRef.current;
      if (drag?.pointerId !== e.pointerId)
        return;
      moveTo(keepVisible({ x: drag.offset.x + e.clientX - drag.x, y: drag.offset.y + e.clientY - drag.y }));
    };
    const endDrag = (e) => {
      if (dragRef.current?.pointerId !== e.pointerId)
        return;
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId))
        e.currentTarget.releasePointerCapture(e.pointerId);
    };
    const chooseCustom = (value) => {
      if (fillInput(String(value).trim()))
        onMinimize(true);
    };
    const chooseOption = (index) => chooseCustom("\u6211\u9009\u62E9\uFF1A" + renderText(decision.options[index]?.label ?? ""));
    const chooseOptions = (indices) => chooseCustom("\u6211\u9009\u62E9\uFF1A" + indices.map((index) => renderText(decision.options[index]?.label ?? "")).filter(Boolean).join("\u3001"));
    const multi = decision.multiSelect === true && Array.isArray(decision.options) && decision.options.length > 0;
    const [picked, setPicked] = React.useState([]);
    const [custom, setCustom] = React.useState("");
    const header = decision.header !== void 0 && decision.header !== "" ? String(decision.header) : null;
    const question = String(decision.question ?? "");
    const title = header ?? (question !== "" ? question : "\u63A5\u4E0B\u6765\u505A\u4EC0\u4E48\uFF1F");
    const cardClass = "dsh-rp-decision-card" + (decisionMinimized ? " dsh-rp-decision-card-minimized" : "");
    return React.createElement("div", { className: "dsh-rp-decision-backdrop" }, React.createElement("div", {
      className: cardClass,
      ref: cardRef,
      style: {
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        "--rp-decision-visible-height": Math.max(84, viewportHeight - 16) + "px"
      }
    }, React.createElement("div", {
      className: "dsh-rp-decision-head",
      tabIndex: 0,
      title: "\u62D6\u52A8\u51B3\u7B56\u5361\uFF1B\u53CC\u51FB\u6216\u6309 Home \u5F52\u4F4D",
      onPointerDown: startDrag,
      onPointerMove: moveDrag,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: () => {
        dragRef.current = null;
      },
      onDoubleClick: (e) => {
        if (!e.target?.closest?.("button,input"))
          moveTo({ x: 0, y: 0 });
      },
      onKeyDown: (e) => {
        if (e.target !== e.currentTarget)
          return;
        const deltas = {
          ArrowLeft: [
            -20,
            0
          ],
          ArrowRight: [
            20,
            0
          ],
          ArrowUp: [
            0,
            -20
          ],
          ArrowDown: [
            0,
            20
          ]
        };
        const delta = deltas[e.key];
        if (!delta && e.key !== "Home")
          return;
        e.preventDefault();
        e.stopPropagation();
        moveTo(e.key === "Home" ? { x: 0, y: 0 } : keepVisible({ x: offsetRef.current.x + delta[0], y: offsetRef.current.y + delta[1] }));
      }
    }, React.createElement("span", { className: "dsh-rp-decision-title" }, "\u2726 " + title), React.createElement("span", { className: "dsh-rp-decision-head-actions" }, React.createElement("button", {
      type: "button",
      className: "dsh-rp-decision-close",
      title: decisionMinimized ? "\u6062\u590D\u51B3\u7B56\u5361" : "\u6700\u5C0F\u5316\u51B3\u7B56\u5361",
      "aria-label": decisionMinimized ? "\u6062\u590D\u51B3\u7B56\u5361" : "\u6700\u5C0F\u5316\u51B3\u7B56\u5361",
      onClick: () => {
        onMinimize(!decisionMinimized);
      }
    }, decisionMinimized ? "\u2303" : "\u2014"), React.createElement("button", {
      type: "button",
      className: "dsh-rp-decision-close",
      title: "\u7A0D\u540E\u5904\u7406",
      "aria-label": "\u7A0D\u540E\u5904\u7406",
      onClick: onDismiss
    }, "\xD7"))), decisionMinimized ? null : React.createElement("div", { className: "dsh-rp-decision-scroll" }, header !== null && question !== "" && question !== header ? React.createElement("div", { className: "dsh-rp-decision-question" }, question) : null, React.createElement("div", { className: "dsh-rp-decision-options" }, decision.options.map((o, i) => {
      const active = multi ? picked.includes(i) : false;
      return React.createElement("button", {
        key: i,
        type: "button",
        className: "dsh-rp-decision-option" + (active ? " dsh-rp-decision-option-active" : ""),
        onClick: () => {
          if (multi)
            setPicked((p) => p.includes(i) ? p.filter((x) => x !== i) : [...p, i]);
          else
            chooseOption(i);
        }
      }, React.createElement("span", { className: "dsh-rp-decision-key" }, String.fromCharCode(65 + i)), o.heart ? React.createElement("span", { className: "dsh-rp-decision-heart" }, "\u2764\uFE0F") : null, React.createElement("span", { className: "dsh-rp-decision-label" }, renderText(o.label ?? ""), o.description ? React.createElement("span", { className: "dsh-rp-decision-desc" }, renderText(o.description)) : null));
    })), multi ? React.createElement("button", {
      type: "button",
      className: "dsh-rp-decision-confirm",
      disabled: picked.length === 0,
      onClick: () => chooseOptions(picked)
    }, "\u586B\u5165\u9009\u4E2D\u884C\u52A8") : null, React.createElement("div", { className: "dsh-rp-decision-custom" }, React.createElement("input", {
      className: "dsh-rp-decision-input",
      placeholder: "\u6216\u8F93\u5165\u81EA\u5DF1\u7684\u884C\u52A8\u2026",
      value: custom,
      onChange: (e) => setCustom(e.target.value),
      onKeyDown: (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          if (!e.isComposing && !e.nativeEvent?.isComposing && e.keyCode !== 229 && custom.trim())
            chooseCustom(custom);
        }
      }
    }), React.createElement("button", {
      type: "button",
      className: "dsh-rp-decision-send",
      disabled: custom.trim() === "",
      onClick: () => chooseCustom(custom)
    }, "\u586B\u5165\u8F93\u5165\u6846")))));
  }
  const decisionSeat = /* @__PURE__ */ (() => {
    let host = null, root = null, props = null, observer = null, disposed = false;
    const editorForSeat = () => [...document.querySelectorAll("[data-composer-input]")].find((editor) => editor.isConnected && !editor.closest('[hidden], [aria-hidden="true"]') && editor.getClientRects().length > 0);
    const render = () => {
      const current = props;
      if (root)
        root.render(current ? React.createElement(DecisionCard, {
          ...current,
          key: `${current.sessionId}:${current.decision.seq}`,
          fillInput: (value) => fill(value, current.sessionId)
        }) : null);
    };
    const attach = () => {
      if (disposed || !props || resolveActiveSessionId() !== props.sessionId) {
        host?.remove();
        return;
      }
      const editor = editorForSeat();
      if (!editor) {
        host?.remove();
        return;
      }
      if (!host) {
        host = document.createElement("div");
        host.className = "dsh-rp-decision-mount";
        host.setAttribute("data-roleplay-decision-mount", "");
        root = createRoot(host);
      }
      host.setAttribute("data-session-id", props.sessionId);
      const parent = editor.closest("[data-composer-card]") ?? editor.closest("form") ?? editor.parentElement;
      const scroll = editor.closest("[data-input-scroll]");
      const anchor = scroll?.parentElement === parent ? scroll.nextSibling : parent === editor.parentElement ? editor.nextSibling : null;
      if (host.parentElement !== parent || scroll?.parentElement === parent && scroll.nextSibling !== host)
        parent.insertBefore(host, anchor);
    };
    const fill = (raw, sessionId) => {
      const value = String(raw ?? "").trim();
      if (!value || sessionId !== props?.sessionId || sessionId !== resolveActiveSessionId())
        return false;
      const editor = editorForSeat();
      if (!editor) {
        toast("\u8F93\u5165\u6846\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
        return false;
      }
      try {
        editor.focus();
        if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editor), "value")?.set;
          if (!setter)
            return false;
          setter.call(editor, editor.value + value);
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
          if (!document.execCommand("insertText", false, value))
            throw new Error("editor insertion failed");
        }
        toast("\u5DF2\u586B\u5165\u8F93\u5165\u6846\uFF0C\u53EF\u4FEE\u6539\u540E\u53D1\u9001");
        return true;
      } catch {
        toast("\u672A\u80FD\u586B\u5165\u8F93\u5165\u6846\uFF0C\u8BF7\u91CD\u8BD5");
        return false;
      }
    };
    return {
      update(next) {
        if (disposed)
          return;
        props = next;
        if (!props) {
          render();
          host?.remove();
          observer?.disconnect();
          return;
        }
        attach();
        render();
        if (!observer)
          observer = new MutationObserver(() => {
            const previous = root;
            attach();
            if (root && !previous)
              render();
          });
        observer.observe(document.body, { childList: true, subtree: true });
      },
      dispose() {
        disposed = true;
        observer?.disconnect();
        root?.unmount();
        host?.remove();
      }
    };
  })();
  return { DecisionCard, decisionSeat };
}

// status-surface.js
function createStatusSurface({ React, createRoot, resolveActiveSessionId, isRoleplaySession, useTavernActivity, BackgroundNotesBanner, fetchState, stateVersion, subscribeState, invalidateState, applyImmersive, readImmersive, runMaintenance, toast }) {
  const { DecisionCard, decisionSeat } = createDecisionSeat({ React, createRoot, resolveActiveSessionId, toast });
  function StatusOverlay({ sessionId }) {
    const [state, setState] = React.useState(null);
    const [loading, setLoading] = React.useState(Boolean(sessionId || resolveActiveSessionId()));
    const [refreshing, setRefreshing] = React.useState(false);
    const refreshPanelRef = React.useRef(null);
    const [minimized, setMinimizedRaw] = React.useState(() => {
      try {
        const saved = localStorage.getItem("dsh-roleplay-ui.statusCollapsed");
        return saved === null ? true : saved === "1";
      } catch {
        return true;
      }
    });
    const setMinimized = (value) => {
      const next = Boolean(value);
      setMinimizedRaw(next);
      try {
        localStorage.setItem("dsh-roleplay-ui.statusCollapsed", next ? "1" : "0");
      } catch {
      }
    };
    const loadFailureRef = React.useRef({ at: 0, message: "" });
    const activeSessionId = sessionId || resolveActiveSessionId();
    const backgroundActivity = useTavernActivity(activeSessionId);
    const initialSessionLoading = Boolean(activeSessionId && isRoleplaySession(activeSessionId) && state?.sessionId !== activeSessionId);
    const [statusMode, setStatusModeRaw] = React.useState(() => {
      try {
        return localStorage.getItem("dsh-roleplay-ui.statusMode") === "side" ? "side" : "float";
      } catch {
        return "float";
      }
    });
    const setStatusMode = (m) => {
      setStatusModeRaw(m);
      try {
        localStorage.setItem("dsh-roleplay-ui.statusMode", m);
      } catch {
      }
    };
    React.useEffect(() => {
      const toggle = () => setStatusMode(statusMode === "side" ? "float" : "side");
      window.addEventListener("dsh-roleplay-status-mode", toggle);
      return () => window.removeEventListener("dsh-roleplay-status-mode", toggle);
    }, [statusMode]);
    const WINDOW_PREF_KEY = "dsh-roleplay-ui.windowPrefs";
    const loadPrefs = () => {
      try {
        return JSON.parse(localStorage.getItem(WINDOW_PREF_KEY) ?? "null") ?? {};
      } catch {
        return {};
      }
    };
    const prefsRef = React.useRef(loadPrefs());
    const visiblePoint = (point, margin = 40) => point && Number.isFinite(Number(point.left)) && Number.isFinite(Number(point.top)) && Number(point.left) >= 0 && Number(point.top) >= 0 && Number(point.left) <= Math.max(0, window.innerWidth - margin) && Number(point.top) <= Math.max(0, window.innerHeight - margin) ? { left: Number(point.left), top: Number(point.top) } : null;
    const storedSize = prefsRef.current.size;
    const initialSize = storedSize && Number.isFinite(Number(storedSize.w)) && Number.isFinite(Number(storedSize.h)) ? {
      w: Math.min(Math.max(200, Number(storedSize.w)), Math.max(200, window.innerWidth - 20)),
      h: Math.min(Math.max(160, Number(storedSize.h)), Math.max(160, window.innerHeight - 20))
    } : { w: 280, h: 360 };
    const [pos, setPosRaw] = React.useState(visiblePoint(prefsRef.current.pos, 60));
    const [size, setSizeRaw] = React.useState(initialSize);
    const badgeClampWidth = () => Math.min(260, Math.max(72, window.innerWidth - 16));
    const [badgePos, setBadgePosRaw] = React.useState(visiblePoint(prefsRef.current.badgePos, badgeClampWidth()));
    const posRef = React.useRef(pos);
    const sizeRef = React.useRef(size);
    const badgePosRef = React.useRef(badgePos);
    const badgeDraggedRef = React.useRef(false);
    const setPosBoth = (v) => {
      posRef.current = v;
      setPosRaw(v);
    };
    const setSizeBoth = (v) => {
      sizeRef.current = v;
      setSizeRaw(v);
    };
    const setBadgePosBoth = (v) => {
      badgePosRef.current = v;
      setBadgePosRaw(v);
    };
    const persistPrefs = (patch) => {
      prefsRef.current = { ...prefsRef.current, ...patch };
      try {
        localStorage.setItem(WINDOW_PREF_KEY, JSON.stringify(prefsRef.current));
      } catch {
      }
    };
    const clampGeometry = () => {
      const currentSize = sizeRef.current ?? { w: 280, h: 360 };
      const nextSize = {
        w: Math.min(Math.max(200, Number(currentSize.w) || 280), Math.max(200, window.innerWidth - 20)),
        h: Math.min(Math.max(160, Number(currentSize.h) || 360), Math.max(160, window.innerHeight - 20))
      };
      if (nextSize.w !== currentSize.w || nextSize.h !== currentSize.h)
        setSizeBoth(nextSize);
      const currentPos = posRef.current;
      if (currentPos) {
        const nextPos = {
          left: Math.min(Math.max(0, Number(currentPos.left) || 0), Math.max(0, window.innerWidth - Math.min(nextSize.w, 60))),
          top: Math.min(Math.max(0, Number(currentPos.top) || 0), Math.max(0, window.innerHeight - 60))
        };
        if (nextPos.left !== currentPos.left || nextPos.top !== currentPos.top)
          setPosBoth(nextPos);
      }
      const currentBadge = badgePosRef.current;
      if (currentBadge) {
        const nextBadge = {
          left: Math.min(Math.max(0, Number(currentBadge.left) || 0), Math.max(0, window.innerWidth - badgeClampWidth())),
          top: Math.min(Math.max(0, Number(currentBadge.top) || 0), Math.max(0, window.innerHeight - 36))
        };
        if (nextBadge.left !== currentBadge.left || nextBadge.top !== currentBadge.top)
          setBadgePosBoth(nextBadge);
      }
      persistPrefs({ pos: posRef.current, size: sizeRef.current, badgePos: badgePosRef.current });
    };
    React.useEffect(() => {
      clampGeometry();
      const onViewportChange = () => clampGeometry();
      window.addEventListener("resize", onViewportChange);
      window.addEventListener("orientationchange", onViewportChange);
      return () => {
        window.removeEventListener("resize", onViewportChange);
        window.removeEventListener("orientationchange", onViewportChange);
      };
    }, []);
    const onHeaderPointerDown = (e) => {
      if (e.target && typeof e.target.closest === "function" && e.target.closest("button"))
        return;
      e.preventDefault();
      const el = e.currentTarget && e.currentTarget.parentElement;
      if (!el)
        return;
      const rect = el.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
      const move = (ev) => {
        setPosBoth({
          left: Math.min(Math.max(0, start.left + ev.clientX - start.x), window.innerWidth - 60),
          top: Math.min(Math.max(0, start.top + ev.clientY - start.y), window.innerHeight - 60)
        });
      };
      const up = () => {
        persistPrefs({ pos: posRef.current });
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
    const onResizePointerDown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const start = { x: e.clientX, y: e.clientY, w: sizeRef.current.w, h: sizeRef.current.h };
      const move = (ev) => {
        setSizeBoth({
          w: Math.min(Math.max(200, start.w + ev.clientX - start.x), window.innerWidth - 20),
          h: Math.min(Math.max(160, start.h + ev.clientY - start.y), window.innerHeight - 20)
        });
      };
      const up = () => {
        persistPrefs({ size: sizeRef.current });
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
    const onBadgePointerDown = (e) => {
      if (e.button !== 0)
        return;
      e.preventDefault();
      badgeDraggedRef.current = false;
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
      const move = (ev) => {
        const dx = ev.clientX - start.x;
        const dy = ev.clientY - start.y;
        if (!badgeDraggedRef.current && Math.hypot(dx, dy) < 4)
          return;
        badgeDraggedRef.current = true;
        setBadgePosBoth({
          left: Math.min(Math.max(0, start.left + dx), Math.max(0, window.innerWidth - rect.width - 8)),
          top: Math.min(Math.max(0, start.top + dy), Math.max(0, window.innerHeight - rect.height - 8))
        });
      };
      const up = () => {
        if (badgeDraggedRef.current)
          persistPrefs({ badgePos: badgePosRef.current });
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
    const minimizeKey = `${activeSessionId}:${state?.decision?.seq ?? ""}`;
    const [dismissedSeq, setDismissedSeq] = React.useState(-1);
    const [decisionDisplay, setDecisionDisplay] = React.useState({ key: "", minimized: true });
    const decisionMinimized = decisionDisplay.key !== minimizeKey || decisionDisplay.minimized;
    React.useEffect(() => {
      document.body.classList.toggle("rp-composer-compact", state?.sessionId === activeSessionId && state?.preset === "roleplay");
      return () => document.body.classList.remove("rp-composer-compact");
    }, [activeSessionId, state?.sessionId, state?.preset]);
    React.useEffect(() => {
      setDismissedSeq(-1);
      const restore = () => {
        setDismissedSeq(-1);
        if (activeSessionId)
          invalidateState(activeSessionId);
      };
      const toggle = () => setDismissedSeq((previous) => previous >= 0 ? -1 : Number(state?.decision?.seq ?? -1));
      window.addEventListener("dsh-roleplay-view-activated", restore);
      window.addEventListener("dsh-roleplay-decision-toggle", toggle);
      return () => {
        window.removeEventListener("dsh-roleplay-view-activated", restore);
        window.removeEventListener("dsh-roleplay-decision-toggle", toggle);
      };
    }, [activeSessionId, state?.decision?.seq]);
    React.useEffect(() => {
      const decision = state?.sessionId === activeSessionId && state?.preset === "roleplay" ? normalizeDecision(state.decision) : null;
      if (!activeSessionId || !decision?.options?.length || decision.answered === true || decision.superseded === true || Number(decision.seq) <= dismissedSeq) {
        decisionSeat.update(null);
        return;
      }
      decisionSeat.update({
        sessionId: activeSessionId,
        decision,
        decisionMinimized,
        renderText: (text) => renderUserVars(text, state),
        onMinimize: (next) => {
          setDecisionDisplay({ key: minimizeKey, minimized: next });
        },
        onDismiss: () => {
          setDismissedSeq(Number(decision.seq));
        }
      });
    }, [activeSessionId, state, dismissedSeq, decisionMinimized, minimizeKey]);
    React.useEffect(() => () => decisionSeat.update(null), [activeSessionId]);
    React.useEffect(() => {
      setState(null);
      setLoading(Boolean(activeSessionId));
      if (!activeSessionId)
        return;
      let alive = true;
      const requestedSessionId = activeSessionId;
      let scheduler = null;
      const load = async (manual = false) => {
        if (!alive)
          return;
        const requestEpoch = stateVersion(requestedSessionId);
        if (!isRoleplaySession(requestedSessionId)) {
          if (alive) {
            setState(null);
            setLoading(false);
          }
          return;
        }
        if (!manual && typeof document !== "undefined" && document.hidden)
          return;
        if (manual)
          setRefreshing(true);
        try {
          const d = await fetchState(requestedSessionId, true);
          if (!alive)
            return;
          if (stateVersion(requestedSessionId) !== requestEpoch) {
            scheduler?.request();
            return;
          }
          if (d?.sessionId !== requestedSessionId) {
            setState(null);
            return;
          }
          if (d?.preset === "roleplay")
            applyImmersive(readImmersive());
          loadFailureRef.current = { at: 0, message: "" };
          setLoading(false);
          setState(d);
        } catch (error) {
          if (!alive)
            return;
          const message = String(error && typeof error === "object" && "message" in error ? error.message : error);
          const now = Date.now();
          const previous = loadFailureRef.current;
          if (message !== previous.message || now - previous.at >= 3e4) {
            loadFailureRef.current = { at: now, message };
            toast("\u72B6\u6001\u680F\u6682\u65F6\u65E0\u6CD5\u5237\u65B0\uFF1A" + message);
          }
        } finally {
          if (alive && manual)
            setRefreshing(false);
        }
      };
      scheduler = createRefreshScheduler(() => load());
      refreshPanelRef.current = async (manual = false) => {
        if (manual)
          await load(true);
        else
          scheduler?.request();
      };
      scheduler.request();
      const unsubscribe = subscribeState(requestedSessionId, () => scheduler.request());
      const onVisible = () => {
        if (!document.hidden)
          scheduler?.request();
      };
      document.addEventListener("visibilitychange", onVisible);
      const timer = setInterval(() => scheduler.request(), 3e4);
      return () => {
        alive = false;
        refreshPanelRef.current = null;
        unsubscribe();
        scheduler.close();
        clearInterval(timer);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }, [activeSessionId]);
    React.useEffect(() => {
      if (activeSessionId && backgroundActivity?.sessionId === activeSessionId)
        invalidateState(activeSessionId);
    }, [activeSessionId, backgroundActivity?.storySeq, backgroundActivity?.stage, backgroundActivity?.running]);
    const currentState = state?.sessionId === activeSessionId && state?.preset === "roleplay" ? state : null;
    if (!activeSessionId || !isRoleplaySession(activeSessionId) || !currentState && !loading && !initialSessionLoading)
      return null;
    const renderLoadingBody = () => React.createElement("div", { className: "dsh-rp-status-empty", role: "status", "aria-live": "polite" }, "\u72B6\u6001\u680F\u66F4\u65B0\u4E2D\u2026");
    if (!currentState) {
      const loadingTitle = "\u72B6\u6001\u680F\u66F4\u65B0\u4E2D\u2026";
      const loadingMain = statusMode === "side" && !minimized ? React.createElement("div", { className: "dsh-rp-status-dock" }, React.createElement("div", { className: "dsh-rp-status-dock-head" }, React.createElement("span", { className: "dsh-rp-status-title" }, loadingTitle)), renderLoadingBody()) : minimized ? React.createElement("div", { className: "dsh-rp-status-badge", role: "status", "aria-live": "polite" }, React.createElement("span", { className: "dsh-rp-status-badge-icon" }, "\u2726"), React.createElement("span", { className: "dsh-rp-status-badge-label" }, loadingTitle), React.createElement("span", { className: "dsh-rp-status-badge-dot" })) : React.createElement("div", {
        className: "dsh-rp-status-window",
        style: {
          width: size.w,
          height: size.h,
          ...pos ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" } : {}
        }
      }, React.createElement("div", { className: "dsh-rp-status-head", onPointerDown: onHeaderPointerDown }, React.createElement("span", { className: "dsh-rp-status-title" }, loadingTitle), React.createElement("button", { type: "button", className: "dsh-rp-status-min", title: "\u6700\u5C0F\u5316", onClick: () => setMinimized(true) }, "\u2014")), renderLoadingBody(), React.createElement("div", { className: "dsh-rp-status-resize", onPointerDown: onResizePointerDown, title: "\u62D6\u52A8\u8C03\u6574\u5927\u5C0F" }));
      return React.createElement(React.Fragment, null, loadingMain);
    }
    const panel = normalizePanel(currentState.statusPanel);
    const renderVars = (text) => renderUserVars(text, state);
    const rules = Array.isArray(currentState.statusSpec?.regexRules) ? currentState.statusSpec.regexRules : [];
    const applyRules = (text) => {
      let out = renderVars(text);
      for (const r of rules) {
        try {
          out = out.replace(new RegExp(r.match, "g"), r.replace ?? "");
        } catch {
        }
      }
      return out;
    };
    const statusAuthorRoots = [
      ".dsh-rp-status-window .dsh-rp-status-author",
      ".dsh-rp-status-dock .dsh-rp-status-author"
    ];
    const options = Array.isArray(panel?.options) ? panel.options.map(normalizeOption).map((option) => ({ ...option, label: applyRules(option.label) })) : [];
    const html = panel?.html ? statusFactsHtml(applyRules(scopeHtmlStyles(decodeStatusTemplate(panel.html), statusAuthorRoots)), options) : "";
    const fields = Array.isArray(panel?.fields) ? panel.fields.map(normalizeField) : [];
    const renderPanelBody = () => !panel ? React.createElement("div", { className: "dsh-rp-status-empty", role: "status" }, React.createElement("span", null, "\u5F53\u524D\u5206\u652F\u6682\u65E0\u72B6\u6001\u680F\u5185\u5BB9"), React.createElement("button", {
      type: "button",
      className: "dsh-rp-status-option",
      disabled: refreshing,
      onClick: async () => {
        setRefreshing(true);
        try {
          await runMaintenance(activeSessionId, "status-rebuild");
          await refreshPanelRef.current?.(true);
        } catch (error) {
          toast("\u72B6\u6001\u680F\u751F\u6210\u5931\u8D25\uFF1A" + String(error && typeof error === "object" && "message" in error ? error.message : error));
        } finally {
          setRefreshing(false);
        }
      }
    }, refreshing ? "\u5237\u65B0\u4E2D\u2026" : "\u5237\u65B0\u72B6\u6001\u680F")) : React.createElement(React.Fragment, null, panel.stale === true || currentState.statusPanel?.stale === true ? React.createElement("div", { className: "dsh-rp-status-stale", role: "status" }, "\u5267\u60C5\u5DF2\u4FEE\u6539\uFF0C\u72B6\u6001\u680F\u5F85\u66F4\u65B0") : null, React.createElement("div", { className: "dsh-rp-status-author" }, html ? React.createElement("div", {
      className: "dsh-rp-status-html",
      ref: (element) => {
        if (!element)
          return;
        const roots = Array.from(element.children).filter((child) => !["STYLE", "SCRIPT"].includes(child.tagName));
        for (const child of Array.from(element.children))
          child.removeAttribute("data-dsh-status-fill-root");
        if (roots.length === 1 && [
          "DIV",
          "SECTION",
          "ARTICLE",
          "ASIDE",
          "MAIN"
        ].includes(roots[0].tagName))
          roots[0].setAttribute("data-dsh-status-fill-root", "");
      },
      dangerouslySetInnerHTML: { __html: html }
    }) : null, !html && fields.length ? fields.map((f, i) => React.createElement("div", { key: i, className: "dsh-rp-status-field" }, React.createElement("span", { className: "dsh-rp-status-emoji" }, f.emoji ?? ""), " ", React.createElement("span", null, f.label ? renderVars(f.label) + "\uFF1A" : "", applyRules(f.value)))) : null));
    let main = null;
    if (statusMode === "side" && !minimized) {
      main = React.createElement("div", { className: "dsh-rp-status-dock" }, React.createElement("div", { className: "dsh-rp-status-dock-head" }, React.createElement("span", { className: "dsh-rp-status-title" }, applyRules(panel?.title || "\u72B6\u6001\u680F")), React.createElement("button", {
        type: "button",
        className: "dsh-rp-status-min",
        title: "\u6298\u53E0\u72B6\u6001\u680F",
        "aria-label": "\u6298\u53E0\u72B6\u6001\u680F",
        onClick: () => setMinimized(true)
      }, React.createElement("svg", {
        width: 15,
        height: 15,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true"
      }, React.createElement("rect", { x: 3, y: 4, width: 18, height: 16, rx: 2 }), React.createElement("path", { d: "M8 4v16" }), React.createElement("path", { d: "m14 9 3 3-3 3" })))), renderPanelBody());
    } else if (minimized) {
      const badgeLabel = applyRules(String(panel?.title || "\u72B6\u6001\u680F")).slice(0, 12);
      main = React.createElement("div", {
        className: "dsh-rp-status-badge",
        role: "button",
        tabIndex: 0,
        "aria-expanded": "false",
        title: "\u6062\u590D\u72B6\u6001\u680F\uFF08\u53EF\u62D6\u52A8\uFF09",
        style: badgePos ? { left: badgePos.left, top: badgePos.top, right: "auto", bottom: "auto" } : void 0,
        onPointerDown: onBadgePointerDown,
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setMinimized(false);
          }
        },
        onClick: () => {
          if (badgeDraggedRef.current) {
            badgeDraggedRef.current = false;
            return;
          }
          setMinimized(false);
        }
      }, React.createElement("span", { className: "dsh-rp-status-badge-icon" }, "\u2726"), React.createElement("span", { className: "dsh-rp-status-badge-label" }, badgeLabel), React.createElement("span", { className: "dsh-rp-status-badge-dot" }));
    } else {
      main = React.createElement("div", {
        className: "dsh-rp-status-window",
        style: {
          width: size.w,
          height: size.h,
          ...pos ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" } : {}
        }
      }, React.createElement("div", { className: "dsh-rp-status-head", onPointerDown: onHeaderPointerDown }, React.createElement("span", { className: "dsh-rp-status-title" }, applyRules(panel?.title || "\u72B6\u6001\u680F")), React.createElement("button", { type: "button", className: "dsh-rp-status-min", title: "\u6700\u5C0F\u5316", onClick: () => setMinimized(true) }, "\u2014")), renderPanelBody(), React.createElement("div", { className: "dsh-rp-status-resize", onPointerDown: onResizePointerDown, title: "\u62D6\u52A8\u8C03\u6574\u5927\u5C0F" }));
    }
    return React.createElement(React.Fragment, null, main, React.createElement(BackgroundNotesBanner, { activity: backgroundActivity, sessionId: activeSessionId }));
  }
  return { DecisionCard, decisionSeat, StatusOverlay };
}

// message-actions.js
function createMessageActionComponents({ React, isRoleplaySession, fetchState, subscribeState, invalidateState, applyImmersive, readImmersive, toast, confirmWithDialog: confirmWithDialog2, runCommand, replaceMessage, forkAndPrompt, forkWithoutUserTurn, openNativeBranch, retryBranchMutation }) {
  const ICONS = {
    regenerate: React.createElement("svg", {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
    }), React.createElement("path", {
      d: "M21 3v5h-5"
    })),
    download: React.createElement("svg", {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
    }), React.createElement("polyline", {
      points: "7 10 12 15 17 10"
    }), React.createElement("line", {
      x1: 12,
      y1: 15,
      x2: 12,
      y2: 3
    })),
    edit: React.createElement("svg", {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M12 20h9"
    }), React.createElement("path", {
      d: "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
    })),
    trash: React.createElement("svg", {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M3 6h18"
    }), React.createElement("path", {
      d: "M8 6V4h8v2"
    }), React.createElement("path", {
      d: "M19 6l-1 14H6L5 6"
    }), React.createElement("path", {
      d: "M10 11v5M14 11v5"
    })),
    removeTurn: React.createElement("svg", {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("path", {
      d: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h7"
    }), React.createElement("path", {
      d: "m16 5 5 5M21 5l-5 5"
    })),
    chevronLeft: React.createElement("svg", {
      width: 12,
      height: 12,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("polyline", {
      points: "15 18 9 12 15 6"
    })),
    chevronRight: React.createElement("svg", {
      width: 12,
      height: 12,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("polyline", {
      points: "9 18 15 12 9 6"
    })),
    copy: React.createElement("svg", {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, React.createElement("rect", {
      x: 9,
      y: 9,
      width: 11,
      height: 11,
      rx: 2
    }), React.createElement("path", {
      d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
    }))
  };
  const actionIconButton = (title, icon, onClick, extra = {}) => React.createElement("button", {
    type: "button",
    className: "dsh-rp-icon-btn",
    title,
    "aria-label": title,
    onClick,
    ...extra
  }, icon);
  function MessageEditor({ title, initialText, allowSend = false, busy = false, onClose, onSave, onSend }) {
    const [text, setText] = React.useState(String(initialText ?? ""));
    const dialogRef = React.useRef(null);
    React.useEffect(() => setText(String(initialText ?? "")), [initialText]);
    React.useLayoutEffect(() => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.open)
        dialog.showModal();
      return () => {
        if (dialog?.open)
          dialog.close();
      };
    }, []);
    const ready = text.trim().length > 0 && !busy;
    return React.createElement("dialog", {
      className: "dsh-rp-edit-backdrop",
      ref: dialogRef,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title,
      onCancel: (event) => {
        event.preventDefault();
        if (!busy)
          onClose();
      },
      onMouseDown: (event) => {
        if (event.target === event.currentTarget && !busy)
          onClose();
      }
    }, React.createElement("div", {
      className: "dsh-rp-edit-card"
    }, React.createElement("div", {
      className: "dsh-rp-edit-title"
    }, title), React.createElement("textarea", {
      className: "dsh-rp-edit-textarea",
      value: text,
      autoFocus: true,
      disabled: busy,
      onChange: (event) => setText(event.target.value),
      onKeyDown: (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && ready)
          onSave(text.trim());
      }
    }), React.createElement("div", {
      className: "dsh-rp-edit-buttons"
    }, React.createElement("span", {
      className: "dsh-rp-edit-hint"
    }, allowSend ? "\u4FDD\u5B58\uFF1A\u539F\u5730\u4FEE\u6539\uFF1B\u53D1\u9001\uFF1A\u65B0\u5EFA\u73A9\u5BB6\u5206\u652F\u5E76\u751F\u6210\u5267\u60C5" : "\u4FDD\u5B58\u53EA\u4FEE\u6539\u5F53\u524D Agent \u56DE\u590D\uFF0C\u4E0D\u8C03\u7528\u6A21\u578B"), React.createElement("button", {
      type: "button",
      className: "dsh-rp-edit-action",
      disabled: busy,
      onClick: onClose
    }, "\u53D6\u6D88"), React.createElement("button", {
      type: "button",
      className: "dsh-rp-edit-action",
      disabled: !ready,
      onClick: () => onSave(text.trim())
    }, "\u4FDD\u5B58"), allowSend ? React.createElement("button", {
      type: "button",
      className: "dsh-rp-edit-action",
      "data-primary": "true",
      disabled: !ready,
      onClick: () => onSend(text.trim())
    }, "\u53D1\u9001") : null)));
  }
  function useRoleplayState(sessionId) {
    const [state, setState] = React.useState(() => isRoleplaySession(sessionId) ? null : {
      preset: "other"
    });
    const [revision, setRevision] = React.useState(0);
    const reload = React.useCallback(async () => {
      if (!isRoleplaySession(sessionId))
        return {
          preset: "other"
        };
      const data = await fetchState(sessionId, true);
      setState(data);
      return data;
    }, [sessionId]);
    React.useEffect(() => {
      if (!sessionId || !isRoleplaySession(sessionId)) {
        setState({
          preset: "other"
        });
        return;
      }
      let alive = true;
      fetchState(sessionId).then((data) => {
        if (!alive)
          return;
        if (data?.preset === "roleplay")
          applyImmersive(readImmersive());
        setState(data);
      }).catch(() => {
        if (alive)
          setState({
            preset: "other"
          });
      });
      const unsubscribe = subscribeState(sessionId, () => {
        if (alive)
          setRevision((value) => value + 1);
      });
      return () => {
        alive = false;
        unsubscribe();
      };
    }, [sessionId]);
    React.useEffect(() => {
      if (!sessionId || !isRoleplaySession(sessionId) || revision === 0)
        return;
      let alive = true;
      fetchState(sessionId, true).then((data) => {
        if (alive)
          setState(data);
      }).catch(() => {
      });
      return () => {
        alive = false;
      };
    }, [sessionId, revision]);
    return [state, reload];
  }
  function UserActions(props) {
    const sessionId = props.sessionId;
    const seq = Number(props.seq);
    const initialText = String(props.text ?? "");
    const [state, reload] = useRoleplayState(sessionId);
    const [busy, setBusy] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    if (state === null || state?.preset !== "roleplay")
      return React.createElement("span");
    const info = state?.userActionsBySeq?.[String(seq)] ?? null;
    const deleted = Array.isArray(state?.deletedBranchMessageIds) && state.deletedBranchMessageIds.includes(String(info?.assistantMessageId ?? ""));
    if (deleted)
      return React.createElement("span", {
        className: "dsh-rp-deleted"
      }, "\u6B64\u5267\u60C5\u7248\u672C\u5DF2\u5220\u9664\uFF08\u53EA\u8BFB\uFF09");
    const group = info?.group ?? null;
    const members = Array.isArray(group?.members) ? group.members : [];
    const currentIndex = group ? Math.max(0, Number(group.currentOrdinal) - 1) : -1;
    const perform = async (operation) => {
      if (busy)
        return;
      setBusy(true);
      try {
        await operation();
      } catch (error) {
        toast(String(error && typeof error === "object" && "message" in error ? error.message : error));
      } finally {
        setBusy(false);
      }
    };
    const editor = editing ? React.createElement(MessageEditor, {
      title: "\u4FEE\u6539\u73A9\u5BB6\u6D88\u606F",
      initialText,
      allowSend: true,
      busy,
      onClose: () => {
        if (!busy)
          setEditing(false);
      },
      onSave: (text) => perform(async () => {
        await replaceMessage({
          sessionId,
          role: "user",
          seq,
          text
        });
        setEditing(false);
        await reload();
        toast("\u5DF2\u4FDD\u5B58\u5230\u5F53\u524D\u73A9\u5BB6\u5206\u652F\uFF1BAgent \u56DE\u590D\u4FDD\u6301\u4E0D\u53D8");
      }),
      onSend: (text) => perform(async () => {
        setEditing(false);
        await forkAndPrompt({
          sourceSessionId: sessionId,
          messageId: info?.assistantMessageId,
          userSeq: seq,
          kind: "player-edit",
          editedText: text
        });
      })
    }) : null;
    return React.createElement(React.Fragment, null, React.createElement("span", {
      className: "dsh-rp-actions"
    }, group && members.length > 0 ? [
      actionIconButton("\u4E0A\u4E00\u4E2A\u73A9\u5BB6\u6D88\u606F\u5206\u652F", ICONS.chevronLeft, () => perform(() => openNativeBranch(members[currentIndex - 1])), {
        key: "upl",
        disabled: busy || currentIndex <= 0
      }),
      React.createElement("span", {
        key: "upp",
        className: "dsh-rp-pager",
        title: "\u73A9\u5BB6\u6D88\u606F\u5206\u652F"
      }, `${currentIndex + 1}/${members.length}`),
      actionIconButton("\u4E0B\u4E00\u4E2A\u73A9\u5BB6\u6D88\u606F\u5206\u652F", ICONS.chevronRight, () => perform(() => openNativeBranch(members[currentIndex + 1])), {
        key: "upr",
        disabled: busy || currentIndex < 0 || currentIndex >= members.length - 1
      })
    ] : null, actionIconButton("\u4FEE\u6539\u73A9\u5BB6\u6D88\u606F", ICONS.edit, () => setEditing(true), {
      disabled: busy || !Number.isSafeInteger(seq)
    }), actionIconButton("\u5220\u9664\u8FD9\u6761\u73A9\u5BB6\u6D88\u606F\u53CA\u5176\u5168\u90E8\u540E\u7EED\u5185\u5BB9", ICONS.removeTurn, () => perform(async () => {
      if (!info?.assistantMessageId)
        throw new Error("\u8FD9\u6761\u73A9\u5BB6\u6D88\u606F\u5C1A\u65E0\u53EF\u5B89\u5168\u622A\u65AD\u7684\u56DE\u590D\u951A\u70B9");
      if (!await confirmWithDialog2(document, "\u4ECE\u8FD9\u91CC\u622A\u65AD\u5F53\u524D\u5267\u60C5\uFF1F\u8FD9\u6761\u73A9\u5BB6\u6D88\u606F\u53CA\u5168\u90E8\u540E\u7EED\u5185\u5BB9\u4E0D\u4F1A\u8FDB\u5165\u65B0\u5206\u652F\uFF1B\u539F\u59CB\u5BA1\u8BA1\u65E5\u5FD7\u4ECD\u53EF\u6062\u590D\u3002", {
        title: "\u622A\u65AD\u5F53\u524D\u5267\u60C5",
        confirmLabel: "\u786E\u8BA4\u622A\u65AD"
      }))
        return;
      await forkWithoutUserTurn({
        sourceSessionId: sessionId,
        messageId: info.assistantMessageId
      });
    }), {
      disabled: busy || !info?.assistantMessageId
    })), editor);
  }
  function AssistantActions(props) {
    const sessionId = props.sessionId;
    const [state, reload] = useRoleplayState(sessionId);
    const anchor = state?.assistantActionAnchorsByTurn?.[String(props.turn)];
    const messageId = String(props.messageId || anchor?.messageId || "");
    const initialText = String(props.text || anchor && state?.surfaceNodes?.find((node) => node.seq === anchor.seq)?.text || "");
    const [busy, setBusy] = React.useState(false);
    const [editing, setEditing] = React.useState(false);
    if (state === null || state?.preset !== "roleplay") {
      return React.createElement("span");
    }
    if (state?.internalAssistantMessageIds?.includes(String(props.messageId ?? "")) || state?.internalMaintenanceTurns?.includes(Number(props.turn)))
      return React.createElement("span");
    const validRecoverySeq = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    const stateRecoverySeq = state?.failedTurnRecoveryByTurn?.[String(props.turn)];
    const recoverySeq = validRecoverySeq(stateRecoverySeq) ? stateRecoverySeq : null;
    const recoveryAvailable = recoverySeq !== null;
    const failureGroup = recoveryAvailable ? state?.failedTurnBranchGroupByTurn?.[String(props.turn)] ?? null : null;
    const group = failureGroup ?? state?.branchGroupsByMessageId?.[messageId] ?? null;
    const deleted = !recoveryAvailable && Array.isArray(state?.deletedBranchMessageIds) && state.deletedBranchMessageIds.includes(messageId);
    if (deleted)
      return React.createElement("span", {
        className: "dsh-rp-deleted"
      }, "\u6B64\u56DE\u590D\u7248\u672C\u5DF2\u5220\u9664\uFF08\u53EA\u8BFB\uFF09");
    const inherited = Array.isArray(state?.inheritedAssistantMessageIds) && state.inheritedAssistantMessageIds.includes(messageId);
    const members = Array.isArray(group?.members) ? group.members : [];
    const currentIndex = group ? Math.max(0, Number(group.currentOrdinal) - 1) : -1;
    const perform = async (operation) => {
      if (busy)
        return;
      setBusy(true);
      try {
        await operation();
      } catch (error) {
        toast(String(error && typeof error === "object" && "message" in error ? error.message : error));
      } finally {
        setBusy(false);
      }
    };
    const editor = editing ? React.createElement(MessageEditor, {
      title: "\u76F4\u63A5\u4FEE\u6539\u5F53\u524D Agent \u56DE\u590D",
      initialText,
      busy,
      onClose: () => {
        if (!busy)
          setEditing(false);
      },
      onSave: (text) => perform(async () => {
        await replaceMessage({
          sessionId,
          role: "assistant",
          messageId,
          text
        });
        setEditing(false);
        await reload();
        toast("\u5DF2\u4FDD\u5B58\u5F53\u524D Agent \u56DE\u590D\uFF0C\u4E0D\u8C03\u7528\u6A21\u578B");
      })
    }) : null;
    return React.createElement(React.Fragment, null, React.createElement("span", {
      className: "dsh-rp-actions"
    }, group && members.length > 0 ? [
      actionIconButton("\u4E0A\u4E00\u7248 Agent \u56DE\u590D", ICONS.chevronLeft, () => perform(() => openNativeBranch(members[currentIndex - 1])), {
        disabled: busy || currentIndex <= 0
      }),
      React.createElement("span", {
        key: "p",
        className: "dsh-rp-pager"
      }, `${currentIndex + 1}/${members.length}`),
      actionIconButton("\u4E0B\u4E00\u7248 Agent \u56DE\u590D", ICONS.chevronRight, () => perform(() => openNativeBranch(members[currentIndex + 1])), {
        disabled: busy || currentIndex < 0 || currentIndex >= members.length - 1
      })
    ] : null, actionIconButton(recoveryAvailable ? "\u6062\u590D\u5931\u8D25\u8F6E\u6B21\u5E76\u751F\u6210 Agent \u56DE\u590D" : "\u91CD\u65B0\u751F\u6210 Agent \u56DE\u590D", ICONS.regenerate, () => {
      perform(() => forkAndPrompt({
        sourceSessionId: sessionId,
        messageId: recoveryAvailable ? void 0 : messageId || void 0,
        userSeq: recoveryAvailable ? recoverySeq : void 0,
        kind: "regenerate"
      }));
    }, {
      disabled: busy || !messageId && !recoveryAvailable
    }), actionIconButton(inherited ? "\u8BF7\u5148\u5207\u6362\u5230\u8BE5\u7248\u672C\u6240\u5C5E\u4F1A\u8BDD\u518D\u7F16\u8F91" : "\u76F4\u63A5\u4FEE\u6539\u5F53\u524D Agent \u56DE\u590D", ICONS.edit, () => setEditing(true), {
      disabled: busy || recoveryAvailable || inherited || !messageId || !initialText
    }), actionIconButton(group && members.length > 1 ? "\u5220\u9664\u5F53\u524D\u56DE\u590D\u5206\u652F" : "\u81F3\u5C11\u751F\u6210\u4E24\u4E2A\u7248\u672C\u540E\u624D\u80FD\u5220\u9664", ICONS.trash, () => {
      perform(async () => {
        if (recoveryAvailable || !group || members.length <= 1)
          return;
        if (!await confirmWithDialog2(document, `\u5220\u9664\u5F53\u524D\u7B2C ${currentIndex + 1}/${members.length} \u4E2A\u56DE\u590D\u5206\u652F\uFF1F\u539F\u59CB\u5BA1\u8BA1\u65E5\u5FD7\u4ECD\u4F1A\u4FDD\u7559\u3002`, {
          title: "\u5220\u9664\u56DE\u590D\u5206\u652F",
          confirmLabel: "\u786E\u8BA4\u5220\u9664"
        }))
          return;
        const result = await retryBranchMutation({
          action: "delete",
          sessionId,
          messageId
        });
        invalidateState(sessionId);
        await openNativeBranch({
          sessionId: result.nextSessionId
        });
      });
    }, {
      disabled: busy || recoveryAvailable || !group || members.length <= 1
    }), actionIconButton("\u5BFC\u51FA\u5C0F\u8BF4\u7A3F", ICONS.download, () => runCommand(sessionId, "/export-novel llm"))), editor);
  }
  return {
    ICONS,
    actionIconButton,
    MessageEditor,
    useRoleplayState,
    UserActions,
    AssistantActions
  };
}
function createToastController(documentRef) {
  let timer = null;
  let current = null;
  const dismiss = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    current?.remove?.();
    current = null;
  };
  const managerHost = () => {
    const dialogs = [...documentRef.querySelectorAll?.("dialog.dsh-rp-dialog[open]") ?? []];
    return dialogs.findLast?.((dialog) => {
      try {
        return dialog.matches?.(":modal");
      } catch {
        return false;
      }
    }) ?? dialogs.at(-1) ?? documentRef.body;
  };
  const toast = (text) => {
    if (!documentRef?.body)
      return;
    dismiss();
    const el = documentRef.createElement("div");
    el.className = "dsh-rp-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = String(text ?? "");
    managerHost().appendChild(el);
    current = el;
    timer = setTimeout(dismiss, 2600);
  };
  toast.dismiss = dismiss;
  return toast;
}
function confirmWithDialog(documentRef, message, { title = "\u8BF7\u786E\u8BA4", confirmLabel = "\u786E\u8BA4", cancelLabel = "\u53D6\u6D88" } = {}) {
  return new Promise((resolve) => {
    const dialog = documentRef.createElement("dialog");
    dialog.className = "dsh-rp-confirm-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", title);
    const heading = documentRef.createElement("strong");
    heading.textContent = title;
    const content = documentRef.createElement("p");
    content.textContent = String(message ?? "");
    const actions = documentRef.createElement("div");
    actions.className = "dsh-rp-confirm-actions";
    const cancel = documentRef.createElement("button");
    cancel.type = "button";
    cancel.className = "dsh-rp-btn";
    cancel.textContent = cancelLabel;
    const confirm = documentRef.createElement("button");
    confirm.type = "button";
    confirm.className = "dsh-rp-btn dsh-rp-primary";
    confirm.dataset.confirm = "true";
    confirm.textContent = confirmLabel;
    actions.append(cancel, confirm);
    dialog.append(heading, content, actions);
    documentRef.body.appendChild(dialog);
    let settled = false;
    const finish = (value) => {
      if (settled)
        return;
      settled = true;
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
      if (dialog.open && typeof dialog.close === "function")
        dialog.close();
      dialog.remove();
      resolve(value);
    };
    const onCancel = (event) => {
      event.preventDefault();
      finish(false);
    };
    const onClose = () => finish(dialog.returnValue === "confirm");
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    cancel.addEventListener("click", () => finish(false));
    confirm.addEventListener("click", () => finish(true));
    if (typeof dialog.showModal === "function")
      dialog.showModal();
    else {
      dialog.open = true;
      dialog.setAttribute("open", "");
    }
  });
}

// session-actions.js
var errorDetails = (value) => value && typeof value === "object" ? value : {};
function createRoleplayActions({ sessionsService, openSession, workspacesService, remoteSession, resolveActiveSessionId, isRoleplaySession, wakeSessionForState, invalidateState, acceptConversations, loadConversations, toast, fetch: fetch2 = globalThis.fetch, storage, now = Date.now, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const localStorage2 = {
    getItem: (key) => (storage ?? globalThis.localStorage).getItem(key),
    setItem: (key, value) => (storage ?? globalThis.localStorage).setItem(key, value),
    key: (index) => (storage ?? globalThis.localStorage).key(index),
    get length() {
      return (storage ?? globalThis.localStorage).length;
    }
  };
  const saveState = async (body) => {
    const res = await fetch2("/api/roleplay/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok)
      throw new Error(data.error ?? "\u4FDD\u5B58\u5931\u8D25");
    return data;
  };
  const branchRequest = async (body) => {
    const wakeTarget = String(body?.childSessionId ?? body?.sessionId ?? resolveActiveSessionId() ?? "");
    if (wakeTarget)
      await wakeSessionForState(wakeTarget);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await fetch2("/api/roleplay/branch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const raw = await res.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
      }
      if (res.status === 404 && data === null && attempt === 0 && wakeTarget) {
        await wakeSessionForState(wakeTarget);
        await wait(220);
        continue;
      }
      if (!res.ok || !data?.ok) {
        const detail = data?.error ?? raw.trim().replace(/\s+/g, " ").slice(0, 160);
        const error = new Error(detail || `\u5206\u652F\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${res.status}\uFF09`);
        error.status = res.status;
        error.payload = data;
        throw error;
      }
      if (data.conversations)
        acceptConversations(data.conversations);
      return data;
    }
    throw new Error("\u5206\u652F\u63A5\u53E3\u5728\u5524\u9192\u4F1A\u8BDD\u540E\u4ECD\u4E0D\u53EF\u7528");
  };
  const delay = wait;
  const runMaintenance = async (sessionId, action) => {
    const request = async (nextAction) => {
      const response = await fetch2("/api/roleplay/maintenance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, action: nextAction })
      });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw new Error(data.error || `HTTP ${response.status}`);
      return data.job;
    };
    let job = await request(action);
    const jobId = job?.id;
    const deadline = now() + 15 * 60 * 1e3;
    while (["running", "waiting-main"].some((state) => state === job?.state) && now() < deadline) {
      await delay(1200);
      job = await request("status");
      if (!job || job.id !== jobId)
        throw new Error("\u7EF4\u62A4\u4EFB\u52A1\u72B6\u6001\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5237\u65B0\u68C0\u67E5");
    }
    if (job?.state !== "completed")
      throw new Error(job?.error || "\u540E\u53F0\u6574\u7406\u4ECD\u5728\u8FDB\u884C\uFF0C\u8BF7\u7A0D\u540E\u5237\u65B0");
    invalidateState(sessionId);
    return job;
  };
  const registerBranchOperation = async (payload) => {
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await branchRequest({ action: "register", ...payload });
      } catch (error2) {
        lastError = error2;
        if (Number.isFinite(errorDetails(error2).status) && Number(errorDetails(error2).status) < 500)
          throw error2;
        await delay(250 * (attempt + 1));
      }
    }
    try {
      const status = await branchRequest({ action: "operation-status", operationId: payload.operationId });
      if (status.status === "completed" || status.status === "pending" && status.registered === true) {
        return { ok: true, recovered: true, ...status };
      }
      if (status.status === "failed")
        throw new Error(status.error || "\u5206\u652F\u767B\u8BB0\u5931\u8D25");
    } catch (statusError) {
      if (Number.isFinite(errorDetails(statusError).status) && Number(errorDetails(statusError).status) < 500)
        throw statusError;
    }
    const error = lastError ?? new Error("\u65E0\u6CD5\u786E\u8BA4\u5206\u652F\u767B\u8BB0\u72B6\u6001");
    error.operationStateUnknown = true;
    throw error;
  };
  const retryBranchMutation = async (body, attempts = 4) => {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await branchRequest(body);
      } catch (error) {
        lastError = error;
        if (Number.isFinite(errorDetails(error).status) && Number(errorDetails(error).status) < 500)
          throw error;
        if (attempt + 1 < attempts)
          await delay(250 * (attempt + 1));
      }
    }
    throw lastError ?? new Error("\u5206\u652F\u64CD\u4F5C\u5931\u8D25");
  };
  const remoteFailure = (label, result) => {
    const code = result?.error?.code ? `${result.error.code}: ` : "";
    return new Error(label + "\uFF1A" + code + String(result?.error?.message ?? "\u672A\u77E5\u8FDC\u7AEF\u9519\u8BEF"));
  };
  const withSession = (sessionId, operation) => sessionsService.using(sessionId, { source: "nexttavernAction" }, (reference) => operation(reference.binding));
  const repairActiveConversationDraft = () => {
    const sessionId = resolveActiveSessionId();
    const keys = /* @__PURE__ */ new Set();
    if (sessionId && isRoleplaySession(sessionId))
      keys.add(`dsh.conversation.${sessionId}`);
    try {
      for (let i = 0; i < localStorage2.length; i++) {
        const key = localStorage2.key(i);
        if (key?.startsWith("dsh.conversation."))
          keys.add(key);
      }
    } catch {
    }
    for (const key of keys) {
      try {
        const value = JSON.parse(localStorage2.getItem(key) ?? "null");
        if (value && typeof value.view === "string" && typeof value.draft !== "string") {
          localStorage2.setItem(key, JSON.stringify({ ...value, draft: "" }));
        }
      } catch {
      }
    }
  };
  repairActiveConversationDraft();
  const openSessionPreservingView = async (targetSessionId, sourceSessionId = resolveActiveSessionId()) => {
    if (sourceSessionId && targetSessionId && sourceSessionId !== targetSessionId) {
      try {
        const sourceKey = `dsh.conversation.${sourceSessionId}`;
        const targetKey = `dsh.conversation.${targetSessionId}`;
        const source = JSON.parse(localStorage2.getItem(sourceKey) ?? "null");
        if (source && typeof source.view === "string") {
          const target = JSON.parse(localStorage2.getItem(targetKey) ?? "{}");
          localStorage2.setItem(targetKey, JSON.stringify({
            ...target,
            draft: typeof target?.draft === "string" ? target.draft : "",
            view: source.view,
            viewRequest: null
          }));
        }
      } catch {
      }
    }
    const selected = await branchRequest({ action: "select-worldline", sessionId: targetSessionId });
    if (selected.conversations)
      acceptConversations(selected.conversations);
    openSession(targetSessionId);
  };
  const workspaceIdForSession = (sessionId) => {
    try {
      const items = workspacesService?.list?.getSnapshot?.()?.items ?? [];
      return items.find((workspace) => Array.isArray(workspace?.sessionIds) && workspace.sessionIds.includes(sessionId))?.workspaceId;
    } catch {
      return void 0;
    }
  };
  const copyModelSelection = async (sourceBinding, childId) => {
    try {
      const projected = sourceBinding?.session?.projections?.faceOf?.("modelSelection")?.getSnapshot?.();
      const selection = projected?.next ?? projected?.selected ?? projected;
      if (!selection?.provider || !selection?.model || !remoteSession?.selectModel)
        return;
      const result = await remoteSession.selectModel({
        sessionId: childId,
        provider: selection.provider,
        model: selection.model,
        ...selection.reasoningEffort ? { reasoningEffort: selection.reasoningEffort } : {}
      });
      if (!result?.ok)
        toast("\u65B0\u5206\u652F\u5DF2\u521B\u5EFA\uFF0C\u4F46\u6A21\u578B\u9009\u62E9\u672A\u80FD\u7EE7\u627F\uFF1A" + String(result?.error?.message ?? "\u672A\u77E5\u9519\u8BEF"));
    } catch (error) {
      toast("\u65B0\u5206\u652F\u5DF2\u521B\u5EFA\uFF0C\u4F46\u6A21\u578B\u9009\u62E9\u672A\u80FD\u7EE7\u627F\uFF1A" + String(errorDetails(error).message ?? error));
    }
  };
  const createFirstTurnBranch = async (sourceSessionId) => withSession(sourceSessionId, async (sourceBinding) => {
    if (!remoteSession?.create)
      throw new Error("\u4F1A\u8BDD\u521B\u5EFA\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA");
    const sourceRow = sessionsService?.list?.getSnapshot?.()?.byId?.[sourceSessionId];
    const workspaceId = workspaceIdForSession(sourceSessionId);
    const request = workspaceId ? { workspaceId, agentPreset: "roleplay" } : { ...sourceRow?.cwd ? { cwd: sourceRow.cwd } : {}, agentPreset: "roleplay" };
    const created = await remoteSession.create(request);
    if (!created?.ok)
      throw remoteFailure("\u521B\u5EFA\u9996\u8F6E\u5206\u652F\u5931\u8D25", created);
    if (created.value?.agentPreset && created.value.agentPreset !== "roleplay") {
      throw new Error(`\u65B0\u5206\u652F preset \u5F02\u5E38\uFF1A${created.value.agentPreset}`);
    }
    const childId = created.value.sessionId;
    await sessionsService?.refresh?.();
    await copyModelSelection(sourceBinding, childId);
    return { childId };
  });
  const waitForBranchOperation = async (operationId, timeoutMs = 15 * 60 * 1e3, options = {}) => {
    const deadline = now() + timeoutMs;
    let transientFailures = 0;
    let notAcceptedSince = null;
    while (now() < deadline) {
      let result;
      try {
        result = await branchRequest({ action: "operation-status", operationId });
        transientFailures = 0;
      } catch (error) {
        transientFailures += 1;
        if (transientFailures >= 5)
          throw error;
      }
      if (result?.status === "completed")
        return result;
      if (result?.status === "failed")
        throw new Error(result.error || "\u5206\u652F\u751F\u6210\u5931\u8D25");
      if (options.requireRequestAdmission && result?.registered === true && result?.requestAccepted === false) {
        if (notAcceptedSince === null)
          notAcceptedSince = now();
        if (now() - notAcceptedSince >= Number(options.admissionGraceMs ?? 15e3)) {
          const error = new Error("\u53D1\u9001\u8BF7\u6C42\u672A\u8FDB\u5165\u65B0\u5206\u652F\uFF1B\u5DF2\u5B89\u5168\u505C\u6B62\u7B49\u5F85");
          error.safeToAbort = true;
          throw error;
        }
      } else {
        notAcceptedSince = null;
      }
      await delay(900);
    }
    throw new Error("\u7B49\u5F85\u5206\u652F\u751F\u6210\u5B8C\u6210\u8D85\u65F6\uFF1B\u5206\u652F\u4ECD\u4FDD\u7559\u4E3A\u5F85\u5904\u7406\u72B6\u6001\uFF0C\u53EF\u7A0D\u540E\u5207\u6362\u56DE\u6765\u67E5\u770B");
  };
  const replaceMessage = async ({ sessionId, role, seq, messageId, text }) => {
    const result = await retryBranchMutation({
      action: "replace-message",
      sessionId,
      role,
      seq,
      messageId,
      text
    });
    invalidateState(sessionId);
    return result;
  };
  const forkAndPrompt = async ({ sourceSessionId, messageId, userSeq, kind, editedText }) => {
    const prepared = await branchRequest({
      action: "prepare",
      sessionId: sourceSessionId,
      messageId,
      userSeq,
      kind
    });
    let promptText = prepared.promptText;
    if (kind === "player-edit") {
      promptText = editedText;
      if (promptText === null || promptText === void 0)
        return null;
      promptText = String(promptText).trim();
      if (!promptText)
        throw new Error("\u6D88\u606F\u4E0D\u80FD\u4E3A\u7A7A");
    }
    return withSession(sourceSessionId, async (sourceBinding) => {
      if (sourceBinding?.session?.getSnapshot?.()?.running)
        throw new Error("\u8BF7\u7B49\u5F85\u5F53\u524D\u4E00\u8F6E\u5B8C\u6210\u540E\u518D\u521B\u5EFA\u5206\u652F");
      const created = await branchRequest({ action: "create-worldline", operationId: prepared.operationId, sessionId: sourceSessionId });
      const childId = created.childSessionId;
      if (created.conversations)
        acceptConversations(created.conversations);
      await sessionsService.refresh();
      await loadConversations();
      return withSession(childId, async (childBinding) => {
        await copyModelSelection(sourceBinding, childId);
        const submission = childBinding.session.beginSubmission({ mode: "queue", text: promptText, attachments: [] });
        try {
          await wakeSessionForState(childId);
          await registerBranchOperation({
            operationId: prepared.operationId,
            childSessionId: childId,
            requestId: submission.requestId,
            promptText
          });
        } catch (error) {
          submission.abandon();
          if (!errorDetails(error).operationStateUnknown) {
            try {
              await branchRequest({ action: "abort", operationId: prepared.operationId });
            } catch {
            }
          }
          await openSessionPreservingView(sourceSessionId, childId);
          throw error;
        }
        invalidateState(sourceSessionId);
        invalidateState(childId);
        await openSessionPreservingView(childId, sourceSessionId);
        let result;
        try {
          result = await childBinding.session.prompt([{ type: "text", text: promptText }], "queue", void 0, submission.requestId);
        } catch (error) {
          try {
            await waitForBranchOperation(prepared.operationId, 15 * 60 * 1e3, {
              requireRequestAdmission: true,
              admissionGraceMs: 15e3
            });
            invalidateState(sourceSessionId);
            invalidateState(childId);
            return childId;
          } catch (observedError) {
            if (errorDetails(observedError).safeToAbort) {
              let abortResult = null;
              try {
                abortResult = await branchRequest({ action: "abort", operationId: prepared.operationId });
              } catch {
              }
              if (abortResult?.alreadyAccepted) {
                try {
                  await waitForBranchOperation(prepared.operationId);
                  invalidateState(sourceSessionId);
                  invalidateState(childId);
                  return childId;
                } catch (acceptedError) {
                  await openSessionPreservingView(sourceSessionId, childId);
                  throw new Error("\u53D1\u9001\u5DF2\u88AB\u670D\u52A1\u5668\u63A5\u7EB3\uFF0C\u4F46\u672A\u80FD\u786E\u8BA4\u6700\u7EC8\u7ED3\u679C\uFF1A" + String(errorDetails(acceptedError).message ?? acceptedError));
                }
              }
              submission.abandon();
            }
            await openSessionPreservingView(sourceSessionId, childId);
            if (errorDetails(observedError).safeToAbort)
              throw observedError;
            throw new Error(`${String(errorDetails(error).message ?? error)}\uFF1B\u4E14\u672A\u80FD\u786E\u8BA4\u5206\u652F\u6700\u7EC8\u72B6\u6001\uFF1A${String(errorDetails(observedError).message ?? observedError)}`);
          }
        }
        if (!result?.ok) {
          try {
            await branchRequest({ action: "abort", operationId: prepared.operationId });
          } catch {
          }
          await openSessionPreservingView(sourceSessionId, childId);
          throw remoteFailure(kind === "player-edit" ? "\u4FEE\u6539\u540E\u53D1\u9001\u5931\u8D25" : "\u91CD\u65B0\u751F\u6210\u5931\u8D25", result);
        }
        try {
          await waitForBranchOperation(prepared.operationId);
        } finally {
          invalidateState(sourceSessionId);
          invalidateState(childId);
        }
        return childId;
      });
    });
  };
  const forkWithoutUserTurn = async ({ sourceSessionId, messageId }) => {
    const prepared = await branchRequest({
      action: "prepare",
      sessionId: sourceSessionId,
      messageId,
      kind: "delete-user"
    });
    const created = await branchRequest({ action: "create-worldline", operationId: prepared.operationId, sessionId: sourceSessionId });
    const childId = created.childSessionId;
    if (created.conversations)
      acceptConversations(created.conversations);
    await sessionsService.refresh();
    await loadConversations();
    await registerBranchOperation({
      operationId: prepared.operationId,
      childSessionId: childId,
      promptText: ""
    });
    invalidateState(sourceSessionId);
    invalidateState(childId);
    await openSessionPreservingView(childId, sourceSessionId);
    return childId;
  };
  const openNativeBranch = async (member) => {
    if (!member?.sessionId)
      return;
    await openSessionPreservingView(member.sessionId);
  };
  return {
    saveState,
    branchRequest,
    runMaintenance,
    registerBranchOperation,
    retryBranchMutation,
    repairActiveConversationDraft,
    openSessionPreservingView,
    createFirstTurnBranch,
    waitForBranchOperation,
    replaceMessage,
    forkAndPrompt,
    forkWithoutUserTurn,
    openNativeBranch
  };
}

// state-store.js
function createRoleplayStateStore({ sessionsService, isRoleplaySession, fetchRoleplayText: fetchRoleplayText2 = fetchRoleplayText, fetch: fetch2 = globalThis.fetch, now = Date.now, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const STATE_TTL_MS = 8e3;
  const stateCache = /* @__PURE__ */ new Map();
  const stateInflight = /* @__PURE__ */ new Map();
  const stateEpoch = /* @__PURE__ */ new Map();
  const stateListeners = /* @__PURE__ */ new Map();
  const subscribeState = (sessionId, listener) => {
    if (!sessionId || typeof listener !== "function")
      return () => {
      };
    let listeners = stateListeners.get(sessionId);
    if (!listeners) {
      listeners = /* @__PURE__ */ new Set();
      stateListeners.set(sessionId, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (!listeners.size)
        stateListeners.delete(sessionId);
    };
  };
  const invalidateState = (sessionId) => {
    stateCache.delete(sessionId);
    stateEpoch.set(sessionId, (stateEpoch.get(sessionId) ?? 0) + 1);
    for (const listener of [...stateListeners.get(sessionId) ?? []]) {
      try {
        listener();
      } catch {
      }
    }
  };
  const wakeSessionForState = async (sessionId) => {
    try {
      const response = await fetch2("/api/roleplay/wake", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
        cache: "no-store"
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.ok)
        return true;
    } catch {
    }
    try {
      return await sessionsService?.using(sessionId, { source: "nexttavernState" }, () => true) ?? false;
    } catch {
      return false;
    }
  };
  const fetchState = async (sessionId, force = false) => {
    if (!isRoleplaySession(sessionId))
      return { ok: true, sessionId, preset: "other" };
    const hit = stateCache.get(sessionId);
    if (!force && hit && now() - hit.at < STATE_TTL_MS)
      return hit.data;
    const inflight = stateInflight.get(sessionId);
    const epoch = stateEpoch.get(sessionId) ?? 0;
    if (inflight) {
      if (inflight.epoch === epoch)
        return inflight.pending;
      await inflight.pending.catch(() => {
      });
      if (stateInflight.get(sessionId) === inflight)
        stateInflight.delete(sessionId);
      return fetchState(sessionId, force);
    }
    const pending = (async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const { response: res, raw } = await fetchRoleplayText2("/api/roleplay/state?sessionId=" + encodeURIComponent(sessionId));
        let data = null;
        let parseError = false;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          parseError = true;
        }
        if (res.status === 404 && attempt < 3 && await wakeSessionForState(sessionId)) {
          await wait(220 * (attempt + 1));
          continue;
        }
        if (parseError) {
          if (!res.ok) {
            const detail = raw.trim().replace(/\s+/g, " ").slice(0, 160);
            const error = new Error(`\u72B6\u6001\u63A5\u53E3 HTTP ${res.status}${detail ? `\uFF1A${detail}` : ""}`);
            error.status = res.status;
            throw error;
          }
          throw new Error(`\u72B6\u6001\u63A5\u53E3\u8FD4\u56DE\u4E86\u65E0\u6548 JSON\uFF08HTTP ${res.status}\uFF09`);
        }
        if (!res.ok || !data?.ok) {
          const error = new Error(String(data?.error ?? `\u72B6\u6001\u63A5\u53E3 HTTP ${res.status}`));
          error.status = res.status;
          throw error;
        }
        if ((stateEpoch.get(sessionId) ?? 0) === epoch)
          stateCache.set(sessionId, { at: now(), data });
        return data;
      }
      throw new Error("\u72B6\u6001\u63A5\u53E3\u5728\u5524\u9192\u4F1A\u8BDD\u540E\u4ECD\u4E0D\u53EF\u7528");
    })();
    stateInflight.set(sessionId, { epoch, pending });
    try {
      return await pending;
    } finally {
      if (stateInflight.get(sessionId)?.pending === pending)
        stateInflight.delete(sessionId);
    }
  };
  return { fetchState, subscribeState, invalidateState, wakeSessionForState, peekState: (id) => stateCache.get(id)?.data, stateVersion: (id) => stateEpoch.get(id) ?? 0 };
}

// client.js
var errorMessage4 = (error) => String(error && typeof error === "object" && "message" in error ? error.message : error);
var inject = ["slots", "remote.commands", "remote.session", "sessions", "workspaces", "uiSession", "uiWorkspace"];
var IMMERSIVE_KEY = "dsh-roleplay-ui.immersive";
function apply(ctx) {
  const React = require("react");
  const slots = ctx.get("slots");
  const mainSelection = ctx.get("uiSession").adapter.current;
  const navigation = ctx.get("uiWorkspace");
  const sessionsService = ctx.get("sessions");
  const workspacesService = ctx.get("workspaces");
  let remoteSession = null;
  try {
    remoteSession = ctx.get("remote.session");
  } catch {
  }
  const { acceptConversations, loadConversations, TavernWorkspacePresentation } = createConversationPresentation({
    React,
    sessionsService,
    errorMessage: errorMessage4,
    // The native slot is registered before toast initialization, as before.
    // Resolve notification lazily when an open action actually fails.
    toast: (message) => toast(message)
  });
  if (slots !== void 0)
    slots.inject("sidebar.workspaces.presentation", () => slots.register({ name: "sidebar.workspaces.presentation", id: "tavern-conversation-presentation" }, TavernWorkspacePresentation));
  const resolveActiveSessionId = () => mainSelection.getSnapshot().key ?? null;
  const useMainSessionId = () => React.useSyncExternalStore((notify) => mainSelection.subscribe(notify), resolveActiveSessionId, () => null);
  const sessionPresetOf = (sessionId) => {
    if (!sessionId)
      return null;
    try {
      const row = sessionsService?.list?.getSnapshot?.()?.byId?.[sessionId];
      const preset = row?.projectionValues?.agentPreset ?? row?.agentPreset;
      return typeof preset === "string" && preset.trim() ? preset.trim() : null;
    } catch {
      return null;
    }
  };
  const isRoleplaySession = (sessionId) => sessionPresetOf(sessionId) === "roleplay";
  const style = document.createElement("style");
  style.setAttribute("data-plugin-css", "dsh-roleplay-ui");
  style.textContent = ROLEPLAY_UI_CSS + MEMORY_RETRIEVAL_CSS + CARD_ADAPTATION_CSS;
  document.head.appendChild(style);
  ctx.effect(() => () => style.remove(), "roleplay-ui: styles");
  const toast = createToastController(document);
  const runCommand = async (sessionId, line) => {
    const commands = ctx.get("remote.commands");
    if (commands === void 0) {
      const error = new Error("\u547D\u4EE4\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA");
      toast("\u547D\u4EE4\u5931\u8D25\uFF1A" + errorMessage4(error));
      return { ok: false, error };
    }
    try {
      const remoteResult = await commands.execute(sessionId, line, []);
      if (!remoteResult?.ok) {
        const code = remoteResult?.error?.code ? String(remoteResult.error.code) + ": " : "";
        throw new Error(code + String(remoteResult?.error?.message ?? "\u8FDC\u7AEF\u547D\u4EE4\u8C03\u7528\u5931\u8D25"));
      }
      if (remoteResult.value === void 0)
        throw new Error("\u672A\u77E5\u6216\u683C\u5F0F\u9519\u8BEF\u7684\u547D\u4EE4\uFF1A" + line);
      const outcome = remoteResult.value?.result;
      if (outcome?.kind === "error")
        throw new Error(String(outcome.text ?? "\u547D\u4EE4\u5904\u7406\u5931\u8D25"));
      return { ok: true, value: outcome ?? remoteResult.value };
    } catch (error) {
      toast("\u547D\u4EE4\u5931\u8D25\uFF1A" + errorMessage4(error));
      return { ok: false, error };
    }
  };
  const { fetchState, subscribeState, invalidateState, wakeSessionForState, peekState, stateVersion } = createRoleplayStateStore({
    sessionsService,
    isRoleplaySession
  });
  const { useTavernActivity, ActivityBanner, BackgroundNotesBanner, pendingPlayerBubble, DeferredPlayerInput } = createActivityComponents({
    React,
    isRoleplaySession,
    peekState
  });
  if (slots !== void 0)
    slots.inject("conversation.chat.roleplay-progress", () => slots.register({ name: "conversation.chat.roleplay-progress", id: "roleplay-progress", order: 10, inject: (sessionId) => ({ sessionId }) }, DeferredPlayerInput));
  const { saveState, runMaintenance, replaceMessage, forkAndPrompt, forkWithoutUserTurn, openNativeBranch, retryBranchMutation } = createRoleplayActions({
    sessionsService,
    workspacesService,
    openSession: (id) => navigation.openSession(id),
    remoteSession,
    resolveActiveSessionId,
    isRoleplaySession,
    wakeSessionForState,
    invalidateState,
    acceptConversations,
    loadConversations,
    toast
  });
  const readImmersive = () => {
    try {
      const v = localStorage.getItem(IMMERSIVE_KEY);
      return v === null ? true : v === "1";
    } catch {
      return true;
    }
  };
  const applyImmersive = (on) => {
    if (typeof document === "undefined")
      return;
    document.body.classList.toggle("rp-immersive", on);
    try {
      localStorage.setItem(IMMERSIVE_KEY, on ? "1" : "0");
    } catch {
    }
  };
  const { ICONS, actionIconButton, UserActions, AssistantActions } = createMessageActionComponents({
    React,
    isRoleplaySession,
    fetchState,
    subscribeState,
    invalidateState,
    applyImmersive,
    readImmersive,
    toast,
    confirmWithDialog,
    runCommand,
    replaceMessage,
    forkAndPrompt,
    forkWithoutUserTurn,
    openNativeBranch,
    retryBranchMutation
  });
  if (slots !== void 0) {
    slots.inject("conversation.chat.roleplay-failure-actions", () => slots.register({
      name: "conversation.chat.roleplay-failure-actions",
      id: "roleplay-failure-actions",
      order: 30,
      inject: (sessionId) => ({ sessionId })
    }, AssistantActions));
    slots.inject("conversation.chat.assistant-actions", () => slots.register({
      name: "conversation.chat.assistant-actions",
      id: "roleplay-actions",
      order: 30,
      inject: (sessionId) => ({ sessionId })
    }, AssistantActions));
    slots.inject("conversation.chat.user-actions", () => slots.register({
      name: "conversation.chat.user-actions",
      id: "roleplay-user-actions",
      order: 30,
      inject: (sessionId) => ({ sessionId })
    }, UserActions));
  }
  const UserInfoSettings = createUserInfoSettings({ React, toast });
  {
    let RoleplayManager = function({ sessionId, onClose }) {
      const draftKey = `${sessionId ?? "none"}:panel`;
      const savedDraft = sessionDrafts.get(draftKey) ?? {};
      const [tab, setTabRaw] = React.useState(typeof managerState.requestedTab === "string" ? managerState.requestedTab : typeof savedDraft.tab === "string" ? savedDraft.tab : "cards");
      const setTab = (next) => {
        const previous = sessionDrafts.get(draftKey) ?? {};
        updatePanelDraft(sessionDrafts, sessionId, "panel", { tab: next, version: Number(previous.version ?? 0) + 1 });
        setTabRaw(next);
      };
      const roleplay = isRoleplaySession(sessionId);
      React.useEffect(() => {
        const onNeedsConfig2 = (event) => {
          const detail = event.detail;
          if (detail?.sessionId && detail.sessionId !== sessionId)
            return;
          if (detail?.action !== "configure-adaptation-model")
            return;
          setTab("card-adaptation");
        };
        window.addEventListener("dsh-roleplay-needs-config", onNeedsConfig2);
        return () => window.removeEventListener("dsh-roleplay-needs-config", onNeedsConfig2);
      }, [sessionId]);
      const dialogRef = React.useRef(null);
      React.useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog)
          return;
        try {
          if (!dialog.matches?.(":modal")) {
            if (dialog.open)
              dialog.close?.();
            dialog.showModal?.();
          }
        } catch {
        }
        return () => {
          if (dialog.open)
            dialog.close?.();
        };
      }, []);
      const dialogProps = {
        ref: dialogRef,
        className: "dsh-rp-dialog",
        onCancel: (event) => {
          event.preventDefault();
          onClose();
        }
      };
      if (!roleplay || !sessionId)
        return React.createElement("dialog", dialogProps, React.createElement("div", { className: "dsh-rp-muted" }, "\u5F53\u524D\u4F1A\u8BDD\u4E0D\u662F\u89D2\u8272\u626E\u6F14\u4F1A\u8BDD"), React.createElement("button", { className: "dsh-rp-btn", onClick: onClose }, "\u5173\u95ED"));
      const selected = panelTabs.find(([id]) => id === tab);
      const Body = selected?.[2] ?? CardsPanel;
      const primaryTabs = [
        ["core-rules", "\u6838\u5FC3\u8BBE\u5B9A"],
        ["cards", "\u4EBA\u7269\u8BBE\u5B9A"],
        ["worldbook", "\u4E16\u754C\u4E66"],
        ["plot-guidance", "\u5267\u60C5\u6307\u5F15"],
        ["style-specialization", "\u6587\u98CE\u7279\u5316"],
        ["settings", "\u81EA\u5B9A\u4E49\u89C4\u5219"],
        ["memory", "\u8BB0\u5FC6"],
        ["character-cluster", "\u89D2\u8272\u96C6\u7FA4"],
        ["card-adaptation", "\u957F\u6587\u672C\u8F6C\u89D2\u8272\u5361"]
      ];
      const secondaryTabs = [
        ["presets", "\u9884\u8BBE"],
        ["resources", "\u8D44\u6E90\u5E93"],
        ["models", "\u6A21\u578B"],
        ["embedding", "Embedding \u6A21\u578B\u8BBE\u7F6E"],
        ["usage", "\u4F7F\u7528\u7EDF\u8BA1"],
        ["export", "\u5BFC\u51FA"],
        ["userinfo", "\u7528\u6237\u4FE1\u606F"],
        ["logs", "\u65E5\u5FD7"]
      ];
      const tabButton = ([id, label]) => React.createElement("button", {
        className: "dsh-rp-btn",
        key: id,
        "aria-current": tab === id ? "page" : void 0,
        "aria-selected": tab === id,
        onClick: () => setTab(id)
      }, label);
      const tabs = React.createElement("nav", { className: "dsh-rp-dialog-tabs" }, React.createElement("div", { className: "dsh-rp-dialog-tab-row" }, primaryTabs.map(tabButton)), React.createElement("div", { className: "dsh-rp-dialog-tab-divider", "aria-hidden": "true" }), React.createElement("div", { className: "dsh-rp-dialog-tab-row" }, secondaryTabs.map(tabButton)));
      const body = (() => {
        switch (tab) {
          case "card-adaptation":
            return React.createElement(CardAdaptationPanel, {
              key: sessionId + ":card-adaptation",
              sessionId,
              focusModelSettings: managerState.requestedTab === "card-adaptation",
              focusModelSettingsNonce: managerState.requestedFocusNonce ?? 0
            });
          case "presets":
            return React.createElement(PresetPanel, { key: `${sessionId}:presets`, sessionId });
          case "character-cluster":
            return React.createElement(CharacterClusterPanel, { key: `${sessionId}:character-cluster`, sessionId });
          case "logs":
          case "usage":
            return React.createElement(TelemetryPanel, { key: `${sessionId}:${tab}`, sessionId, mode: tab });
          case "userinfo":
            return React.createElement("div", { className: "dsh-rp-panel" }, React.createElement(UserInfoSettings));
          case "models":
            return React.createElement(ModelPanel, { key: `${sessionId}:models`, sessionId });
          case "embedding":
            return React.createElement(EmbeddingPanel, { key: `${sessionId}:embedding`, sessionId });
          case "resources":
            return React.createElement(ResourcesPanel, { key: `${sessionId}:resources`, sessionId });
          case "export":
            return React.createElement(ExportPanel, { key: `${sessionId}:export`, sessionId });
          case "memory":
            return React.createElement(MemoryRetrievalMemoryPanel, {
              key: `${sessionId}:${tab}`,
              sessionId,
              LegacyPanel: MemoryPanel
            });
          default:
            return React.createElement(Body, { key: `${sessionId}:${tab}`, scope: { sessionId }, visible: true });
        }
      })();
      return React.createElement("dialog", dialogProps, React.createElement("div", { className: "dsh-rp-dialog-head" }, React.createElement("strong", null, "\u9152\u9986\u7BA1\u7406"), React.createElement("button", { className: "dsh-rp-btn", onClick: onClose }, "\u5173\u95ED")), tabs, body);
    }, ManagerEntry = function({ useSessions }) {
      const currentSessionId = useMainSessionId();
      React.useEffect(() => {
        if (managerState.open && managerState.sessionId !== currentSessionId) {
          managerState = { ...managerState, sessionId: currentSessionId };
          renderManager();
        }
      }, [currentSessionId]);
      return null;
    };
    const sessionDrafts = /* @__PURE__ */ new Map();
    const jsonFetch = async (url, init) => {
      const response = await fetch(url, init);
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        const error = Object.assign(new Error(data?.error ?? `\u8BF7\u6C42\u5931\u8D25 ${response.status}`), { code: data?.code, details: data?.details });
        throw error;
      }
      return data;
    };
    const { btn, MemoryPanel, WorldbookPanel, CardsPanel, CoreRulesPanel, PlotGuidancePanel, StyleSpecializationPanel, SettingsPanel } = createAuthorPanels({
      React,
      sessionDrafts,
      fetchState,
      invalidateState,
      saveState,
      runMaintenance,
      jsonFetch,
      toast
    });
    const { MemoryPanel: MemoryRetrievalMemoryPanel, EmbeddingPanel, RebuildPrompt } = createMemoryRetrievalPanel({ React, jsonFetch, toast });
    const CardAdaptationPanel = createCardAdaptationPanel({ React, jsonFetch, toast, confirmWithDialog });
    const panelTabs = [
      ["cards", "\u4EBA\u7269\u8BBE\u5B9A", CardsPanel],
      ["worldbook", "\u4E16\u754C\u4E66", WorldbookPanel],
      ["memory", "\u8BB0\u5FC6", MemoryPanel],
      ["core-rules", "\u6838\u5FC3\u8BBE\u5B9A", CoreRulesPanel],
      ["plot-guidance", "\u5267\u60C5\u6307\u5F15", PlotGuidancePanel],
      ["style-specialization", "\u6587\u98CE\u7279\u5316", StyleSpecializationPanel],
      ["settings", "\u81EA\u5B9A\u4E49\u89C4\u5219", SettingsPanel]
    ];
    const { CharacterClusterPanel, ModelPanel, ResourcesPanel, ExportPanel } = createManagementPanels({
      React,
      sessionDrafts,
      jsonFetch,
      toast,
      confirmWithDialog,
      btn
    });
    const PresetPanel = createPresetPanel({
      React,
      jsonFetch,
      toast,
      confirmWithDialog,
      conversations: async () => {
        const catalog = await loadConversations(), snapshot = sessionsService?.list?.getSnapshot?.() ?? {};
        return presetConversationChoices(snapshot, catalog, isRoleplaySession);
      }
    });
    const { TelemetryPanel } = createTelemetryPanels({ React, sessionDrafts, jsonFetch, toast });
    let managerState = {
      sessionId: null,
      open: false
    };
    const managerHost = document.createElement("div");
    document.body.appendChild(managerHost);
    const managerRoot = require("react-dom/client").createRoot(managerHost);
    const renderManager = () => managerRoot.render(managerState.open ? React.createElement(React.Fragment, null, React.createElement(ManagerEntry, { useSessions: managerState.useSessions }), React.createElement(RoleplayManager, {
      key: `${managerState.sessionId}:${managerState.open}`,
      sessionId: managerState.sessionId,
      onClose: () => {
        managerState.open = false;
        renderManager();
      }
    })) : null);
    const openManager = (sessionId, useSessions, requestedTab, requestedFocusNonce = 0) => {
      managerState = { sessionId, useSessions, open: true, requestedTab, requestedFocusNonce };
      renderManager();
    };
    const onNeedsConfig = (event) => {
      const detail = event.detail;
      if (detail?.forwarded || detail?.action !== "configure-adaptation-model" || !detail?.sessionId)
        return;
      if (managerState.open) {
        managerState.requestedTab = "card-adaptation";
        managerState.requestedFocusNonce = (managerState.requestedFocusNonce ?? 0) + 1;
        renderManager();
        window.dispatchEvent(new CustomEvent("dsh-roleplay-needs-config", { detail: { ...detail, forwarded: true } }));
      } else
        openManager(detail.sessionId, void 0, "card-adaptation", 1);
    };
    window.addEventListener("dsh-roleplay-needs-config", onNeedsConfig);
    ctx.effect(() => () => window.removeEventListener("dsh-roleplay-needs-config", onNeedsConfig), "roleplay-ui: adaptation model notice");
    ctx.effect(() => () => {
      managerRoot.unmount();
      managerHost.remove();
    }, "roleplay-ui: panel manager");
    const sidebarIcon = (kind) => React.createElement("svg", {
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1.3,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true
    }, React.createElement("path", {
      d: kind === "tavern" ? "M2 7 8 2l6 5M3.5 6v7.5h9V6M6.5 13.5V9h3v4.5" : kind === "decision" ? "M2 2.5h12v9H8l-3.5 3v-3H2zM4.5 5.5h7M4.5 8h5" : "M2 2.5h12v11H2zM10 2.5v11M4 5h3M4 8h3"
    }));
    const sidebarTooltip = (props, label, button) => React.createElement(require("@deepseek-ai/dsh-client-ui-primitives").Tooltip, { label, side: props?.wide === false ? "right" : "bottom", delayMs: 500 }, button);
    const managerButton = (props) => {
      const sessionId = useMainSessionId();
      return sidebarTooltip(props, "\u9152\u9986\u7BA1\u7406", React.createElement("button", {
        type: "button",
        className: "dsh-rp-nav-entry",
        disabled: !isRoleplaySession(sessionId),
        "aria-label": "\u9152\u9986\u7BA1\u7406",
        onClick: () => openManager(sessionId, props.useSessions)
      }, React.createElement("span", { className: "dsh-rp-nav-icon" }, sidebarIcon("tavern")), props?.wide === false ? null : React.createElement("span", { className: "dsh-rp-nav-label" }, "\u9152\u9986\u7BA1\u7406")));
    };
    const statusModeButton = (props) => {
      const sessionId = useMainSessionId();
      return sidebarTooltip(props, "\u5207\u6362\u72B6\u6001\u680F\u6A21\u5F0F", React.createElement("button", {
        type: "button",
        className: "dsh-rp-status-toggle",
        disabled: !isRoleplaySession(sessionId),
        "aria-label": "\u5207\u6362\u72B6\u6001\u680F\u6A21\u5F0F",
        onClick: () => window.dispatchEvent(new Event("dsh-roleplay-status-mode"))
      }, sidebarIcon("status")));
    };
    const decisionButton = (props) => {
      const sessionId = useMainSessionId();
      return sidebarTooltip(props, "\u663E\u793A\u6216\u9690\u85CF\u51B3\u7B56\u5361", React.createElement("button", {
        type: "button",
        className: "dsh-rp-status-toggle",
        disabled: !isRoleplaySession(sessionId),
        "aria-label": "\u663E\u793A\u6216\u9690\u85CF\u51B3\u7B56\u5361",
        onClick: () => window.dispatchEvent(new Event("dsh-roleplay-decision-toggle"))
      }, sidebarIcon("decision")));
    };
    if (slots !== void 0) {
      slots.inject("sidebar.workspaces.before", () => slots.register({ name: "sidebar.workspaces.before", id: "roleplay-panel-entry", order: 20, inject: () => ({}) }, managerButton));
      slots.inject("sidebar.workspaces.header.action", () => slots.register({ name: "sidebar.workspaces.header.action", id: "roleplay-status-mode", order: 20, inject: () => ({}) }, statusModeButton));
      slots.inject("sidebar.workspaces.header.action", () => slots.register({ name: "sidebar.workspaces.header.action", id: "roleplay-decision-toggle", order: 21, inject: () => ({}) }, decisionButton));
    }
    const syncImmersive = (sessionId) => {
      if (!isRoleplaySession(sessionId)) {
        applyImmersive(false);
        return;
      }
      fetchState(sessionId).then((data) => {
        applyImmersive(data?.preset === "roleplay" && readImmersive());
      }).catch(() => {
      });
    };
    const { decisionSeat, StatusOverlay } = createStatusSurface({
      React,
      createRoot: require("react-dom/client").createRoot,
      resolveActiveSessionId,
      isRoleplaySession,
      useTavernActivity,
      BackgroundNotesBanner,
      fetchState,
      stateVersion,
      subscribeState,
      invalidateState,
      applyImmersive,
      readImmersive,
      runMaintenance,
      toast
    });
    ctx.effect(() => () => decisionSeat.dispose(), "roleplay-ui: composer decision seat");
    const ReaderView = createReaderView({
      React,
      resolveActiveSessionId,
      isRoleplaySession,
      useTavernActivity,
      fetchState,
      sessionsService,
      toast,
      UserActions,
      AssistantActions,
      actionIconButton,
      ICONS,
      pendingPlayerBubble,
      ActivityBanner,
      ACTIVITY_CSS
    });
    if (slots !== void 0) {
      slots.inject("conversation.view", () => slots.register({
        name: "conversation.view",
        id: "roleplay-reader",
        order: 5,
        label: "\u9152\u9986",
        inject: (sessionId) => ({ sessionId })
      }, ReaderView));
    }
    let overlaySessionId = null;
    let overlayRender = null;
    {
      const { createRoot } = require("react-dom/client");
      const overlayHost = document.createElement("div");
      document.body.appendChild(overlayHost);
      const root = createRoot(overlayHost);
      overlayRender = () => {
        root.render(React.createElement(React.Fragment, null, React.createElement(StatusOverlay, { key: overlaySessionId ?? "no-session", sessionId: overlaySessionId }), overlaySessionId && isRoleplaySession(overlaySessionId) ? React.createElement(RebuildPrompt, { key: `rebuild:${overlaySessionId}`, sessionId: overlaySessionId }) : null));
      };
      overlayRender();
      ctx.effect(() => () => {
        root.unmount();
        overlayHost.remove();
      }, "roleplay-ui: status overlay");
    }
    let lastSessionId = null;
    const onMainSelection = () => {
      const sid = resolveActiveSessionId();
      if (sid === lastSessionId)
        return;
      lastSessionId = sid;
      if (sid)
        syncImmersive(sid);
      else
        document.body.classList.remove("rp-immersive");
      overlaySessionId = sid;
      overlayRender?.();
    };
    onMainSelection();
    ctx.effect(() => mainSelection.subscribe(onMainSelection), "roleplay-ui: main view watch");
    ctx.effect(() => () => document.body.classList.remove("rp-immersive"), "roleplay-ui: immersive state");
  }
}
return module.exports; } });
