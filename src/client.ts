import type * as ReactAPI from 'react'
import {projectConversationList,projectConversationWorkspaces,projectConversationSearch,resolveConversationExecution} from './conversation-projection.js'
import type {ConversationCatalog,SessionList,SessionSummary,WorkspaceSnapshot,SearchResult} from './conversation-projection.js'
import type {PanelDraft} from './panel-state.js'

type Root = {render(node:ReactAPI.ReactNode):void;unmount():void}
type CreateRoot = (element:HTMLElement)=>Root
declare function require(name:'react'):typeof ReactAPI
declare function require(name:'react-dom/client'):{createRoot:CreateRoot}
declare function require(name:'@deepseek-ai/dsh-client-ui-primitives'):{Tooltip:ReactAPI.ComponentType<{label:string;side:string;delayMs:number;children?:ReactAPI.ReactNode}>}
type ActionDependencies = Parameters<typeof createRoleplayActions>[0]
type ReaderDependencies = Parameters<typeof createReaderView>[0]
type ActionSession = NonNullable<ReturnType<NonNullable<ActionDependencies['sessionsService']['binding']>>>['session']
type ReaderSession = NonNullable<NonNullable<ReturnType<NonNullable<NonNullable<ReaderDependencies['sessionsService']>['binding']>>>['session']>
interface SessionService extends Omit<ActionDependencies['sessionsService'],'binding'|'list'> {
  binding?(id:string|null):{session:ActionSession & ReaderSession & {open?():unknown}}|null|undefined
  list?:{getSnapshot?():SessionList & {byId?:Record<string,SessionSummary & {cwd?:string;projectionValues?:{agentPreset?:unknown};agentPreset?:unknown}>};subscribe(listener:()=>void):()=>void}
}
type RemoteSession = NonNullable<ActionDependencies['remoteSession']> & {subscribeState?(listener:()=>void):()=>void;subscribe?(listener:()=>void):()=>void}
interface RemoteCommands {execute(id:string,line:string,images:unknown[]):Promise<{ok?:boolean;error?:{code?:unknown;message?:unknown};value?:{result?:{kind?:string;text?:unknown}}}>}
interface Slots {
  inject(name:string,register:()=>unknown):unknown
  register<P>(config:{name:string;id:string;order?:number;label?:string;inject?:(sessionId:string)=>Partial<P>},component:ReactAPI.ComponentType<P>):unknown
}
interface Services {'slots':Slots|undefined;'sessions':SessionService;'workspaces':ActionDependencies['workspacesService'];'remote.session':RemoteSession|null;'remote.commands':RemoteCommands|undefined;'betterSidebar':unknown}
interface ClientContext {get<K extends keyof Services>(name:K):Services[K];effect(setup:()=>void|(()=>void),label:string):unknown}
interface Catalog extends ConversationCatalog {revision?:number;ok?:boolean}
interface CatalogState {status:string;value:Catalog|null;knownIds:readonly string[];error:string|null}
type SessionSelector = <T>(selector:(value:SessionList)=>T)=>T
type WorkspaceSelector = <T>(selector:(value:WorkspaceSnapshot)=>T)=>T
interface BrowserProps {useSessions:SessionSelector;useWorkspaces:WorkspaceSelector;open(id:string):unknown;forkSession(id:string):unknown;searchSessions(...args:unknown[]):Promise<SearchResult>}
interface WorkspaceProps {browserProps:BrowserProps;renderDefault(props:BrowserProps):ReactAPI.ReactNode}
interface SidebarProps {useSessions?:SessionSelector;wide?:boolean}
const errorMessage=(error:unknown)=>String(error && typeof error==='object' && 'message' in error ? error.message : error)

import {createTelemetryPanels} from './telemetry-panels.js'
import {createUserInfoSettings} from './user-info.js'
import {createManagementPanels} from './management-panels.js'
import {createPresetPanel,presetConversationChoices} from './preset-panel.js'
import {createActivityComponents,ACTIVITY_CSS,tavernActivityPresentation} from './activity-view.js'
export {tavernActivityPresentation,backgroundNotesPresentation} from './activity-view.js'
import {createAuthorPanels} from './author-panels.js'
import {createMemoryRetrievalPanel,MEMORY_RETRIEVAL_CSS} from './memory-retrieval-panel.js'
import {createCardAdaptationPanel,CARD_ADAPTATION_CSS} from './card-adaptation-panel.js'
import {createReaderView} from './reader-view.js'
import {createStatusSurface} from './status-surface.js'
import {createToastController,confirmWithDialog} from './message-actions.js'
export {createToastController,confirmWithDialog} from './message-actions.js'
import {createMessageActionComponents} from './message-actions.js'
import {createRoleplayActions} from './session-actions.js'
import {createRoleplayStateStore} from './state-store.js'
import { updatePanelDraft } from './panel-state.js'
export { fetchRoleplayText, startActivityPolling, createRefreshScheduler, updatePanelDraft, buildRulesSaveBody, buildCustomRulesSaveBody, markPanelDraftFields, settlePanelDraftFields } from './panel-state.js'
export { sortLibraryResources, buildModelSettings, buildReasoningEffortOptions, formatFallbackText, isCardReadableResource, normalizePricingSettings, usageCostPresentation, MODEL_PURPOSE_IDS } from './settings-projection.js'
// dsh-roleplay-ui 浏览器半 v2（源文件，构建产物 ../lib/client.js）。
// 变更：操作按钮从会话头部移到消息操作行（与复制/反馈同列），含重新生成
// 版本翻页（k/N）；角色扮演面板由原生 sidebar slots 统一管理。

export const inject = ['slots', 'remote.commands', 'remote.session', 'sessions', 'workspaces']
const DSH_ROLEPLAY_UI_PATCH = 'dsh-roleplay-ui-bundle-v2'

const IMMERSIVE_KEY = 'dsh-roleplay-ui.immersive'

const CSS = `
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
/* 侧边栏面板 */
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
/* 状态栏悬浮窗（仅 roleplay 模式）：可拖动（标题栏）、右下角手柄可缩放 */
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
/* 模式切换按钮由工作区标题行插槽布局。 */
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
/* 侧边停靠面板：与悬浮窗同款中性主题底（--dsw-alias-* 变量），
   美化全部交给卡片的 CSS/HTML/正则规则/JS（.f 委托）——空白卡也干净。 */
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
/* 沉浸模式：隐藏工具/内部节点，正文阅读排版。
   注意：不隐藏 turn-tail —— 它承载操作行（复制/本轮用量/本轮用时/反馈/角色扮演按钮）。 */
/* Native Chat owns process folding and its expandable control. Permanent
   display:none here also hid the disclosure and made its contents uninspectable. */
.rp-immersive [data-chat-flow-kind="assistant-step"] { font-size: 15px; line-height: 1.9; }
.rp-immersive [data-chat-flow-kind="user"] { font-size: 14px; opacity: .92; }
@media (max-width: 768px) {
  .dsh-rp-actions { gap: 4px; }
  .dsh-rp-btn { padding: 1px 6px; font-size: 10px; }
}
`
export function apply(ctx: ClientContext) {
  const React = require('react')
  const slots = ctx.get('slots')
  let betterSidebar: unknown = null
  try { betterSidebar = ctx.get('betterSidebar') } catch {}
  const sessionsService = ctx.get('sessions')
  const workspacesService = ctx.get('workspaces')
  let remoteSession: RemoteSession | null = null
  try { remoteSession = ctx.get('remote.session') } catch {}
  let conversationCatalog: CatalogState={status:'loading',value:null,knownIds:[],error:null}
  const conversationListeners=new Set<()=>void>()
  let conversationLoad:Promise<Catalog>|null=null
  const notifyConversations=()=>{for(const listener of conversationListeners)listener()}
  const acceptConversations=(value: Catalog,knownIds=conversationCatalog.knownIds)=>{
    if(value?.schemaVersion!==1||!value.worldlines||!value.conversations)return
    if(conversationCatalog.value&&value.revision!==undefined&&conversationCatalog.value.revision!==undefined&&value.revision<conversationCatalog.value.revision)return
    const sorted=[...knownIds].sort()
    if(conversationCatalog.status==='ready'&&conversationCatalog.value?.revision===value.revision&&JSON.stringify(sorted)===JSON.stringify(conversationCatalog.knownIds))return
    conversationCatalog={status:'ready',value,knownIds:sorted,error:null};notifyConversations()
  }
  const loadConversations=async():Promise<Catalog>=>{
    if(conversationLoad)return conversationLoad
    const knownIds=sessionsService?.list?.getSnapshot?.()?.ids??[]
    conversationLoad=(async()=>{
      const response=await fetch('/api/roleplay/conversations'),data=await response.json()
      if(!response.ok||!data?.ok||!data.worldlines||!data.conversations)throw new Error('酒馆会话目录暂时不可用')
      acceptConversations(data,knownIds);return data
    })().catch(error=>{conversationCatalog={...conversationCatalog,status:'error',error:String(errorMessage(error))};notifyConversations();throw error})
      .finally(()=>{conversationLoad=null})
    return conversationLoad
  }
  function TavernWorkspacePresentation({browserProps,renderDefault}: WorkspaceProps) {

    const native=browserProps.useSessions(s=>s)
    const catalog=React.useSyncExternalStore(
      React.useCallback(listener=>{conversationListeners.add(listener);return()=>conversationListeners.delete(listener)},[]),
      React.useCallback(()=>conversationCatalog,[]))
    const idsKey=[...(native?.ids??[])].sort().join('\0')
    const catalogReadAt=React.useRef(0)
    const catalogTrailing=React.useRef<ReturnType<typeof setTimeout>|null>(null)
    React.useEffect(()=>{
      // The native session list settles in a stream of updates and each one used
      // to issue a full catalog read; at one round trip per read that kept a
      // connection busy for the whole session. Only this trigger is coalesced -
      // the timer, focus and visibility paths below still read immediately, and
      // a scheduled trailing read makes sure the last update is not lost.
      const CATALOG_READ_MIN_INTERVAL_MS=10000
      const readNow=()=>{catalogReadAt.current=Date.now();void loadConversations().catch(()=>{})}
      const wait=CATALOG_READ_MIN_INTERVAL_MS-(Date.now()-catalogReadAt.current)
      if(wait<=0)readNow()
      else if(catalogTrailing.current===null)catalogTrailing.current=setTimeout(()=>{catalogTrailing.current=null;readNow()},wait)
      const refresh=()=>{if(typeof document==='undefined'||!document.hidden)readNow()}
      if(typeof document!=='undefined')document.addEventListener('visibilitychange',refresh)
      if(typeof window!=='undefined')window.addEventListener('focus',refresh)
      const timer=setInterval(refresh,30000)
      return()=>{
        clearInterval(timer)
        if(catalogTrailing.current!==null){clearTimeout(catalogTrailing.current);catalogTrailing.current=null}
        if(typeof document!=='undefined')document.removeEventListener('visibilitychange',refresh)
        if(typeof window!=='undefined')window.removeEventListener('focus',refresh)
      }
    },[idsKey])
    const reconciledRef=React.useRef(new Set())
    React.useEffect(()=>{
      if(!native.current||!catalog.value)return
      const member=catalog.value.worldlines?.[native.current]
      const root=member?.conversationId??native.current
      const active=resolveConversationExecution(root,catalog.value)
      const key=`${catalog.value.revision}:${root}:${native.current}:${active}`
      if(active===native.current||reconciledRef.current.has(key))return
      reconciledRef.current.add(key)
      browserProps.open(active)
    },[native.current,catalog.value?.revision])
    const projections=React.useRef<{catalog:CatalogState;lists:WeakMap<SessionList,SessionList>;workspaces:WeakMap<WorkspaceSnapshot,WorkspaceSnapshot>} | null>(null)
    if(projections.current?.catalog!==catalog)projections.current={catalog,lists:new WeakMap(),workspaces:new WeakMap()}
    if(!catalog.value)return React.createElement('div',{role:'status',style:{padding:12}},catalog.error??'正在读取酒馆会话…',catalog.error&&React.createElement('button',{onClick:()=>void loadConversations().catch(()=>{})},'重试'))
    const cached=<T extends object>(cache:WeakMap<T,T>,value:T,project:(value:T)=>T)=>{let result=cache.get(value);if(!result){result=project(value);cache.set(value,result)}return result}
    const known=new Set(catalog.knownIds)
    const usePresentedSessions:SessionSelector=selector=>browserProps.useSessions(value=>selector(cached(projections.current!.lists,value,snapshot=>projectConversationList({...snapshot,ids:(snapshot.ids??[]).filter(id=>known.has(id))},catalog.value))))
    const usePresentedWorkspaces:WorkspaceSelector=selector=>browserProps.useWorkspaces(value=>selector(cached(projections.current!.workspaces,value,snapshot=>projectConversationWorkspaces(snapshot,catalog.value))))
    const executionId=(id:string)=>resolveConversationExecution(id,catalog.value)
    return renderDefault({
      useSessions:usePresentedSessions,useWorkspaces:usePresentedWorkspaces,
      open:id=>{void loadConversations().then(latest=>browserProps.open(resolveConversationExecution(id,latest))).catch(error=>toast(errorMessage(error)))},
      forkSession:id=>browserProps.forkSession(executionId(id)),
      searchSessions:async(...args)=>projectConversationSearch(await browserProps.searchSessions(...args),conversationCatalog.value),
    })
  }
  if(slots!==undefined)slots.inject('sidebar.workspaces.presentation',()=>slots.register({name:'sidebar.workspaces.presentation',id:'tavern-conversation-presentation'},TavernWorkspacePresentation))

  // Host versions expose the active session through slightly different
  // snapshot shapes. Keep the fallback permissive and side-effect free.
  const readSessionId = (value: unknown, depth = 0): string | null => {
    if (!value || depth > 3) return null
    if (typeof value === 'string') return value.trim() || null
    if (typeof value !== 'object') return null
    const record=value as Record<string,unknown>
    for (const key of ['sessionId', 'session_id', 'conversationId']) {
      if (typeof record[key] === 'string' && record[key].trim()) return record[key].trim()
    }
    for (const key of ['current', 'active', 'session', 'state', 'snapshot']) {
      const nested = readSessionId(record[key], depth + 1)
      if (nested) return nested
    }
    return null
  }
  const readServiceSnapshot = (value:unknown):unknown => {
    const service=value as Record<string,unknown> | null
    if (!service) return null
    for (const key of ['getSnapshot', 'getCurrent', 'getActive']) {
      if (typeof service[key] === 'function') {
        try {
          const value = service[key]()
          if (value !== undefined && value !== null) return value
        } catch {}
      }
    }
    for (const key of ['current', 'active', 'session', 'snapshot']) {
      if (service[key] !== undefined && service[key] !== null) return service[key]
    }
    return null
  }
  const resolveActiveSessionId = () => {
    try {
      const current = sessionsService?.list?.getSnapshot?.()?.current
      if (typeof current === 'string' && current.trim()) return current.trim()
    } catch {}
    const sidebarId = readSessionId(readServiceSnapshot(betterSidebar))
    if (sidebarId) return sidebarId
    const remoteId = readSessionId(readServiceSnapshot(remoteSession))
    if (remoteId) return remoteId
    if (typeof location !== 'undefined') {
      try {
        const queryId = new URLSearchParams(location.search).get('sessionId')
        if (queryId?.trim()) return queryId.trim()
      } catch {}
    }
    if (typeof document !== 'undefined') {
      const el = document.querySelector('[data-session-id], [data-conversation-session-id]')
      const domId = el?.getAttribute('data-session-id') ?? el?.getAttribute('data-conversation-session-id')
      if (domId?.trim()) return domId.trim()
    }
    return null
  }
  // The roleplay UI is mounted at the application level, while agent preset
  // identity is already available in the native session-list projection. Do
  // not probe roleplay REST routes (or wake a session) merely because the user
  // selected a standard/minimal conversation. Unknown rows are treated as
  // non-roleplay until the native projection says otherwise; this prevents a
  // 404 storm during list refresh and keeps standard sessions untouched.
  const sessionPresetOf = (sessionId: string | null | undefined) => {
    if (!sessionId) return null
    try {
      const row = sessionsService?.list?.getSnapshot?.()?.byId?.[sessionId]
      const preset = row?.projectionValues?.agentPreset ?? row?.agentPreset
      return typeof preset === 'string' && preset.trim() ? preset.trim() : null
    } catch { return null }
  }
  const isRoleplaySession = (sessionId: string | null | undefined) => sessionPresetOf(sessionId) === 'roleplay'

  const style = document.createElement('style')
  style.setAttribute('data-plugin-css', 'dsh-roleplay-ui')
  style.textContent = CSS + MEMORY_RETRIEVAL_CSS + CARD_ADAPTATION_CSS
  document.head.appendChild(style)
  ctx.effect(() => () => style.remove(), 'roleplay-ui: styles')

  const toast = createToastController(document)

  const runCommand = async (sessionId: string, line: string) => {
    const commands = ctx.get('remote.commands')
    if (commands === undefined) {
      const error = new Error('命令服务尚未就绪')
      toast('命令失败：' + errorMessage(error))
      return { ok: false, error }
    }
    try {
      // alpha.3 direct remote signature is (sessionId, line, images, signal?).
      // The third business argument is required and strictly validated as an
      // array: omitting it reports arity=2, while undefined is rejected as
      // invalid images. This matches the official composer implementation.
      const remoteResult = await commands.execute(sessionId, line, [])
      if (!remoteResult?.ok) {
        const code = remoteResult?.error?.code ? String(remoteResult.error.code) + ': ' : ''
        throw new Error(code + String(remoteResult?.error?.message ?? '远端命令调用失败'))
      }
      if (remoteResult.value === undefined) throw new Error('未知或格式错误的命令：' + line)
      const outcome = remoteResult.value?.result
      if (outcome?.kind === 'error') throw new Error(String(outcome.text ?? '命令处理失败'))
      return { ok: true, value: outcome ?? remoteResult.value }
    } catch (error) {
      toast('命令失败：' + errorMessage(error))
      return { ok: false, error }
    }
  }

  // ── 共享状态缓存（/api/roleplay/state）─────────────────────────────────────
  const {fetchState,subscribeState,invalidateState,wakeSessionForState,peekState,stateVersion} = createRoleplayStateStore({sessionsService,isRoleplaySession})
  const {useTavernActivity,ActivityBanner,BackgroundNotesBanner,pendingPlayerBubble,DeferredPlayerInput} = createActivityComponents({React,isRoleplaySession,peekState})
  if(slots!==undefined)slots.inject('conversation.chat.roleplay-progress',()=>slots.register({name:'conversation.chat.roleplay-progress',id:'roleplay-progress',order:10,inject:sessionId=>({sessionId})},DeferredPlayerInput))

  const {saveState,runMaintenance,replaceMessage,forkAndPrompt,forkWithoutUserTurn,openNativeBranch,retryBranchMutation} = createRoleplayActions({sessionsService,workspacesService,remoteSession,resolveActiveSessionId,isRoleplaySession,wakeSessionForState,invalidateState,acceptConversations,loadConversations,toast})

  const readImmersive = () => {
    try {
      const v = localStorage.getItem(IMMERSIVE_KEY)
      return v === null ? true : v === '1'
    } catch {
      return true
    }
  }
  const applyImmersive = (on: boolean) => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle('rp-immersive', on)
    try {
      localStorage.setItem(IMMERSIVE_KEY, on ? '1' : '0')
    } catch {}
  }

  // ── 消息操作行：版本翻页 + 重新生成/导出（仅 roleplay 会话渲染；
  //     分支复用原版自带按钮）─────────────────────────────────────────────

  // Lucide 风格内联图标（ISC 许可的开放路径，stroke=currentColor）
  const {ICONS,actionIconButton,UserActions,AssistantActions} = createMessageActionComponents({React,isRoleplaySession,fetchState,subscribeState,invalidateState,applyImmersive,readImmersive,toast,confirmWithDialog,runCommand,replaceMessage,forkAndPrompt,forkWithoutUserTurn,openNativeBranch,retryBranchMutation})

  if (slots !== undefined) {
    slots.inject('conversation.chat.assistant-actions', () =>
      slots.register(
        {
          name: 'conversation.chat.assistant-actions',
          id: 'roleplay-actions',
          order: 30,
          inject: (sessionId) => ({ sessionId }),
        },
        AssistantActions
      )
    )

    slots.inject('conversation.chat.user-actions', () =>
      slots.register(
        {
          name: 'conversation.chat.user-actions',
          id: 'roleplay-user-actions',
          order: 30,
          inject: (sessionId) => ({ sessionId }),
        },
        UserActions
      )
    )

  }
  const UserInfoSettings = createUserInfoSettings({React,toast})


  // ── 原生 sidebar slot 驱动的单一角色扮演管理面板 ──────────────────────────

  {
    const sessionDrafts = new Map<string,PanelDraft>()
    const jsonFetch = async <T,>(url: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(url, init)
      const data = await response.json()
      if (!response.ok || data?.ok === false) { const error = Object.assign(new Error(data?.error ?? `请求失败 ${response.status}`), {code: data?.code, details: data?.details}); throw error }
      return data
    }
    const {btn,MemoryPanel,WorldbookPanel,CardsPanel,CoreRulesPanel,PlotGuidancePanel,StyleSpecializationPanel,SettingsPanel} = createAuthorPanels({React,sessionDrafts,fetchState,invalidateState,saveState,runMaintenance,jsonFetch,toast})
    const {MemoryPanel:MemoryRetrievalMemoryPanel,EmbeddingPanel,RebuildPrompt} = createMemoryRetrievalPanel({React,jsonFetch,toast})
    const CardAdaptationPanel = createCardAdaptationPanel({React,jsonFetch,toast,confirmWithDialog})

    const panelTabs: [string,string,ReactAPI.ComponentType<{scope?:{sessionId:string};visible?:boolean}>][] = [
      ['cards', '人物设定', CardsPanel], ['worldbook', '世界书', WorldbookPanel],
      ['memory', '记忆', MemoryPanel], ['core-rules', '核心设定', CoreRulesPanel],
      ['plot-guidance', '剧情指引', PlotGuidancePanel], ['style-specialization', '文风特化', StyleSpecializationPanel],
      ['settings', '自定义规则', SettingsPanel],
    ]
    const {CharacterClusterPanel,ModelPanel,ResourcesPanel,ExportPanel} = createManagementPanels({React,sessionDrafts,jsonFetch,toast,confirmWithDialog,btn})

    const PresetPanel = createPresetPanel({React,jsonFetch,toast,confirmWithDialog,conversations:async()=>{
      const catalog=await loadConversations(), snapshot=sessionsService?.list?.getSnapshot?.()??{}
      return presetConversationChoices(snapshot,catalog,isRoleplaySession)
    }})

    const {TelemetryPanel} = createTelemetryPanels({React,sessionDrafts,jsonFetch,toast})
    function RoleplayManager({ sessionId, onClose }: {sessionId:string|null|undefined;onClose:()=>void}) {
      const draftKey = `${sessionId ?? 'none'}:panel`
      const savedDraft = sessionDrafts.get(draftKey) ?? {}
      const [tab, setTabRaw] = React.useState(typeof managerState.requestedTab==='string'?managerState.requestedTab:(typeof savedDraft.tab==='string'?savedDraft.tab:'cards'))
      const setTab = (next: string) => { const previous = sessionDrafts.get(draftKey) ?? {}; updatePanelDraft(sessionDrafts, sessionId, 'panel', { tab: next, version: Number(previous.version ?? 0) + 1 }); setTabRaw(next) }
      const roleplay = isRoleplaySession(sessionId)
      React.useEffect(()=>{
        const onNeedsConfig=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.sessionId&&detail.sessionId!==sessionId)return;if(detail?.action!=='configure-adaptation-model')return;setTab('card-adaptation')}
        window.addEventListener('dsh-roleplay-needs-config',onNeedsConfig);return()=>window.removeEventListener('dsh-roleplay-needs-config',onNeedsConfig)
      },[sessionId])
      const dialogRef = React.useRef<HTMLDialogElement>(null)
      React.useLayoutEffect(() => { const dialog = dialogRef.current; if (!dialog) return; try { if (!dialog.matches?.(':modal')) { if (dialog.open) dialog.close?.(); dialog.showModal?.() } } catch {} return () => { if (dialog.open) dialog.close?.() } }, [])
      const dialogProps = { ref: dialogRef, className: 'dsh-rp-dialog', onCancel: (event: ReactAPI.SyntheticEvent<HTMLDialogElement>) => { event.preventDefault(); onClose() } }
      if (!roleplay || !sessionId) return React.createElement('dialog', dialogProps, React.createElement('div', { className: 'dsh-rp-muted' }, '当前会话不是角色扮演会话'), React.createElement('button', { className: 'dsh-rp-btn', onClick: onClose }, '关闭'))
      const selected = panelTabs.find(([id]) => id === tab)
      const Body = selected?.[2] ?? CardsPanel
      const primaryTabs: [string,string][]=[['core-rules','核心设定'],['cards','人物设定'],['worldbook','世界书'],['plot-guidance','剧情指引'],['style-specialization','文风特化'],['settings','自定义规则'],['memory','记忆'],['character-cluster','角色集群'],['card-adaptation','长文本转角色卡']]
      const secondaryTabs: [string,string][]=[['presets','预设'],['resources','资源库'],['models','模型'],['embedding','Embedding 模型设置'],['usage','使用统计'],['export','导出'],['userinfo','用户信息'],['logs','日志']]
      const tabButton=([id,label]:[string,string])=>React.createElement('button',{className:'dsh-rp-btn',key:id,'aria-current':tab===id?'page':undefined,'aria-selected':tab===id,onClick:()=>setTab(id)},label)
      const tabs=React.createElement('nav',{className:'dsh-rp-dialog-tabs'},React.createElement('div',{className:'dsh-rp-dialog-tab-row'},primaryTabs.map(tabButton)),React.createElement('div',{className:'dsh-rp-dialog-tab-divider','aria-hidden':'true'}),React.createElement('div',{className:'dsh-rp-dialog-tab-row'},secondaryTabs.map(tabButton)))
      const body = tab==='card-adaptation'?React.createElement(CardAdaptationPanel,{key:sessionId+':card-adaptation',sessionId,focusModelSettings:managerState.requestedTab==='card-adaptation',focusModelSettingsNonce:managerState.requestedFocusNonce??0}):tab==='presets'?React.createElement(PresetPanel,{key:`${sessionId}:presets`,sessionId}):tab==='character-cluster'?React.createElement(CharacterClusterPanel,{key:`${sessionId}:character-cluster`,sessionId}):['logs','usage'].includes(tab)?React.createElement(TelemetryPanel,{key:`${sessionId}:${tab}`,sessionId,mode:tab}):tab === 'userinfo' ? React.createElement('div',{className:'dsh-rp-panel'},React.createElement(UserInfoSettings)) : tab === 'models' ? React.createElement(ModelPanel, { key: `${sessionId}:models`, sessionId }) : tab === 'embedding' ? React.createElement(EmbeddingPanel, { key: `${sessionId}:embedding`, sessionId }) : tab === 'resources' ? React.createElement(ResourcesPanel, { key: `${sessionId}:resources`, sessionId }) : tab === 'export' ? React.createElement(ExportPanel, { key: `${sessionId}:export`, sessionId }) : tab === 'memory' ? React.createElement(MemoryRetrievalMemoryPanel, { key: `${sessionId}:${tab}`, sessionId, LegacyPanel: MemoryPanel }) : React.createElement(Body, { key: `${sessionId}:${tab}`, scope: { sessionId }, visible: true })
      return React.createElement('dialog', dialogProps, React.createElement('div', { className: 'dsh-rp-dialog-head' }, React.createElement('strong', null, '酒馆管理'), React.createElement('button', { className: 'dsh-rp-btn', onClick: onClose }, '关闭')), tabs, body)
    }
    function ManagerEntry({ useSessions }:SidebarProps) {
      const currentSessionId = useSessions?.(state => state.current)
      React.useEffect(() => {
        if (managerState.open && managerState.sessionId !== currentSessionId) { managerState = { ...managerState, sessionId: currentSessionId }; renderManager() }
      }, [currentSessionId])
      return null
    }
    let managerState: {sessionId:string|null|undefined;open:boolean;useSessions?:SessionSelector;requestedTab?:string;requestedFocusNonce?:number} = { sessionId: null, open: false }
    const managerHost = document.createElement('div'); document.body.appendChild(managerHost)
    const managerRoot = require('react-dom/client').createRoot(managerHost)
    const renderManager = () => managerRoot.render(managerState.open ? React.createElement(React.Fragment, null, React.createElement(ManagerEntry, { useSessions: managerState.useSessions }), React.createElement(RoleplayManager, { key: `${managerState.sessionId}:${managerState.open}`, sessionId: managerState.sessionId, onClose: () => { managerState.open = false; renderManager() } })) : null)
    const openManager = (sessionId:string|null|undefined, useSessions?:SessionSelector, requestedTab?:string, requestedFocusNonce=0) => { managerState = { sessionId, useSessions, open: true, requestedTab, requestedFocusNonce }; renderManager() }
    const onNeedsConfig=(event:Event)=>{const detail=(event as CustomEvent).detail;if(detail?.forwarded||detail?.action!=='configure-adaptation-model'||!detail?.sessionId)return;if(managerState.open){managerState.requestedTab='card-adaptation';managerState.requestedFocusNonce=(managerState.requestedFocusNonce??0)+1;renderManager();window.dispatchEvent(new CustomEvent('dsh-roleplay-needs-config',{detail:{...detail,forwarded:true}}))}else openManager(detail.sessionId,undefined,'card-adaptation',1)}
    window.addEventListener('dsh-roleplay-needs-config',onNeedsConfig)
    ctx.effect(()=>()=>window.removeEventListener('dsh-roleplay-needs-config',onNeedsConfig),'roleplay-ui: adaptation model notice')
    ctx.effect(() => () => { managerRoot.unmount(); managerHost.remove() }, 'roleplay-ui: panel manager')
    const sidebarIcon = (kind: string) => React.createElement('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      React.createElement('path', { d: kind === 'tavern' ? 'M2 7 8 2l6 5M3.5 6v7.5h9V6M6.5 13.5V9h3v4.5' : kind === 'decision' ? 'M2 2.5h12v9H8l-3.5 3v-3H2zM4.5 5.5h7M4.5 8h5' : 'M2 2.5h12v11H2zM10 2.5v11M4 5h3M4 8h3' }))
    // The workspace owner already loads primitives. Resolve its shared Tooltip
    // when this slot renders so native hover/focus behavior and theme stay exact.
    const sidebarTooltip = (props:SidebarProps, label:string, button:ReactAPI.ReactNode) => React.createElement(require('@deepseek-ai/dsh-client-ui-primitives').Tooltip, { label, side: props?.wide === false ? 'right' : 'bottom', delayMs: 500 }, button)
    const managerButton = (props:SidebarProps) => { const sessionId = props?.useSessions?.(state => state.current); return sidebarTooltip(props, '酒馆管理', React.createElement('button', { type: 'button', className: 'dsh-rp-nav-entry', disabled: !isRoleplaySession(sessionId), 'aria-label': '酒馆管理', onClick: () => openManager(sessionId, props.useSessions) }, React.createElement('span', { className: 'dsh-rp-nav-icon' }, sidebarIcon('tavern')), props?.wide === false ? null : React.createElement('span', { className: 'dsh-rp-nav-label' }, '酒馆管理'))) }
    const statusModeButton = (props:SidebarProps) => { const sessionId = props?.useSessions?.(state => state.current); return sidebarTooltip(props, '切换状态栏模式', React.createElement('button', { type: 'button', className: 'dsh-rp-status-toggle', disabled: !isRoleplaySession(sessionId), 'aria-label': '切换状态栏模式', onClick: () => window.dispatchEvent(new Event('dsh-roleplay-status-mode')) }, sidebarIcon('status'))) }
    const decisionButton = (props:SidebarProps) => { const sessionId = props?.useSessions?.(state => state.current); return sidebarTooltip(props, '显示或隐藏决策卡', React.createElement('button', { type: 'button', className: 'dsh-rp-status-toggle', disabled: !isRoleplaySession(sessionId), 'aria-label': '显示或隐藏决策卡', onClick: () => window.dispatchEvent(new Event('dsh-roleplay-decision-toggle')) }, sidebarIcon('decision'))) }
    if (slots !== undefined) {
      slots.inject('sidebar.workspaces.before', () => slots.register({ name: 'sidebar.workspaces.before', id: 'roleplay-panel-entry', order: 20, inject: () => ({}) }, managerButton))
      slots.inject('sidebar.workspaces.header.action', () => slots.register({ name: 'sidebar.workspaces.header.action', id: 'roleplay-status-mode', order: 20, inject: () => ({}) }, statusModeButton))
      slots.inject('sidebar.workspaces.header.action', () => slots.register({ name: 'sidebar.workspaces.header.action', id: 'roleplay-decision-toggle', order: 21, inject: () => ({}) }, decisionButton))
    }

    // 沉浸开关：随当前会话 preset 自动应用（roleplay 默认开）
  const syncImmersive = (sessionId: string) => {
    if (!isRoleplaySession(sessionId)) {
      applyImmersive(false)
      return
    }
    fetchState(sessionId).then((data) => {
        applyImmersive(data?.preset === 'roleplay' && readImmersive())
      }).catch(() => {})
    }

    // ── 状态栏悬浮窗（仅 roleplay 会话；可最小化）────────────────────────────
    const {decisionSeat,StatusOverlay} = createStatusSurface({React,createRoot:require('react-dom/client').createRoot,resolveActiveSessionId,isRoleplaySession,useTavernActivity,BackgroundNotesBanner,fetchState,stateVersion,subscribeState,invalidateState,applyImmersive,readImmersive,runMaintenance,toast})
    ctx.effect(() => () => decisionSeat.dispose(), 'roleplay-ui: composer decision seat')

    // ── 沉浸阅读视图（conversation.view 新视图；仅 roleplay 会话可用）────────
    // 渲染管线：正文正则 → HTML/Markdown → 未命中正则回退 → 作用域 CSS（默认
    // 奶油纸感 + 作者 CSS 追加）→ JS（渲染后沙箱脚本 + .f 点击填入委托）。
    const ReaderView = createReaderView({React,resolveActiveSessionId,isRoleplaySession,useTavernActivity,fetchState,sessionsService,toast,UserActions,AssistantActions,actionIconButton,ICONS,pendingPlayerBubble,ActivityBanner,ACTIVITY_CSS})

    // ReaderView is registered through the native conversation slot only
    // after the declaration is in scope; the previous outer registration built
    // into a reference to an undefined ReaderView while esbuild renamed this
    // block-local declaration to ReaderView2.
    if (slots !== undefined) {
      slots.inject('conversation.view', () =>
        slots.register(
          {
            name: 'conversation.view',
            id: 'roleplay-reader',
            order: 5,
            label: '酒馆',
            inject: (sessionId) => ({ sessionId }),
          },
          ReaderView
        )
      )
    }

    let overlaySessionId: string | null = null
    let overlayRender: (()=>void) | null = null
    {
      const { createRoot } = require('react-dom/client')
      const overlayHost = document.createElement('div')
      document.body.appendChild(overlayHost)
      const root = createRoot(overlayHost)
      overlayRender = () => {
        root.render(React.createElement(React.Fragment, null,
          React.createElement(StatusOverlay, {key: overlaySessionId ?? 'no-session', sessionId: overlaySessionId}),
          overlaySessionId && isRoleplaySession(overlaySessionId) ? React.createElement(RebuildPrompt, {key: `rebuild:${overlaySessionId}`, sessionId: overlaySessionId}) : null,
        ))
      }
      overlayRender()
      ctx.effect(() => () => { root.unmount(); overlayHost.remove() }, 'roleplay-ui: status overlay')
    }

    // 初始同步 + 状态订阅：session list/remote session 提供活动会话来源，
    // 因此先立即读取当前快照（否则 overlaySessionId 永远是 null、悬浮窗不出现），
    // 再用 subscribeState（若有）跟踪会话切换。
    let lastSessionId: string | null = null
    const onSidebarState = () => {
      const sid = resolveActiveSessionId()
      // conversation.view / Reader 切换时宿主快照可能瞬时为空。保留最后一次
      // 已确认会话；一次 null 绝不能卸载状态栏及其恢复徽标。
      if (!sid) return
      if (sid && sid !== lastSessionId) {
        lastSessionId = sid
        syncImmersive(sid)
        overlaySessionId = sid
        if (typeof overlayRender === 'function') overlayRender()
      }
    }
    onSidebarState()
    const sessionList = sessionsService?.list
    if (sessionList && typeof sessionList.subscribe === 'function') {
      ctx.effect(() => sessionList.subscribe(onSidebarState), 'roleplay-ui: active session watch')
    }
    const remoteSub = remoteSession && (typeof remoteSession.subscribeState === 'function' ? remoteSession.subscribeState : remoteSession.subscribe)
    if (typeof remoteSub === 'function') {
      ctx.effect(() => remoteSub.call(remoteSession, onSidebarState), 'roleplay-ui: remote session watch')
    }
    // The active session source is DSH sessions/remote.session. The optional
    // legacy sidebar service is never required for lifecycle or state.
  }
}
