// Generated from runtime/alpha3/src/ui/client.ts; edit the TypeScript source.
import { ROLEPLAY_UI_CSS } from './roleplay-ui-styles.js';
import { createConversationPresentation } from './conversation-presentation.js';
const errorMessage = (error) => String(error && typeof error === 'object' && 'message' in error ? error.message : error);
import { createTelemetryPanels } from './telemetry-panels.js';
import { createUserInfoSettings } from './user-info.js';
import { createManagementPanels } from './management-panels.js';
import { createPresetPanel, presetConversationChoices } from './preset-panel.js';
import { createActivityComponents, ACTIVITY_CSS, tavernActivityPresentation } from './activity-view.js';
export { tavernActivityPresentation, backgroundNotesPresentation } from './activity-view.js';
import { createAuthorPanels } from './author-panels.js';
import { createMemoryRetrievalPanel, MEMORY_RETRIEVAL_CSS } from './memory-retrieval-panel.js';
import { createCardAdaptationPanel, CARD_ADAPTATION_CSS } from './card-adaptation-panel.js';
import { createReaderView } from './reader-view.js';
import { createStatusSurface } from './status-surface.js';
import { createToastController, confirmWithDialog } from './message-actions.js';
export { createToastController, confirmWithDialog } from './message-actions.js';
import { createMessageActionComponents } from './message-actions.js';
import { createRoleplayActions } from './session-actions.js';
import { createRoleplayStateStore } from './state-store.js';
import { updatePanelDraft } from './panel-state.js';
export { fetchRoleplayText, startActivityPolling, createRefreshScheduler, updatePanelDraft, buildRulesSaveBody, buildCustomRulesSaveBody, markPanelDraftFields, settlePanelDraftFields } from './panel-state.js';
export { sortLibraryResources, buildModelSettings, buildReasoningEffortOptions, formatFallbackText, isCardReadableResource, normalizePricingSettings, usageCostPresentation, MODEL_PURPOSE_IDS } from './settings-projection.js';
// dsh-roleplay-ui 浏览器半 v2（源文件，构建产物 ../lib/client.js）。
// 变更：操作按钮从会话头部移到消息操作行（与复制/反馈同列），含重新生成
// 版本翻页（k/N）；角色扮演面板由原生 sidebar slots 统一管理。
export const inject = ['slots', 'remote.commands', 'remote.session', 'sessions', 'workspaces', 'uiSession', 'uiWorkspace'];
const DSH_ROLEPLAY_UI_PATCH = 'dsh-roleplay-ui-bundle-v2';
const IMMERSIVE_KEY = 'dsh-roleplay-ui.immersive';
export function apply(ctx) {
    const React = require('react');
    const slots = ctx.get('slots');
    const mainSelection = ctx.get('uiSession').adapter.current;
    const navigation = ctx.get('uiWorkspace');
    const sessionsService = ctx.get('sessions');
    const workspacesService = ctx.get('workspaces');
    let remoteSession = null;
    try {
        remoteSession = ctx.get('remote.session');
    }
    catch { }
    const { acceptConversations, loadConversations, TavernWorkspacePresentation } = createConversationPresentation({
        React,
        sessionsService,
        errorMessage,
        // The native slot is registered before toast initialization, as before.
        // Resolve notification lazily when an open action actually fails.
        toast: message => toast(message),
    });
    if (slots !== undefined)
        slots.inject('sidebar.workspaces.presentation', () => slots.register({ name: 'sidebar.workspaces.presentation', id: 'tavern-conversation-presentation' }, TavernWorkspacePresentation));
    // The main-view owner publishes explicit absence when archived or released.
    // Secondary SessionProvider views keep their own scoped props.
    const resolveActiveSessionId = () => mainSelection.getSnapshot().key ?? null;
    const useMainSessionId = () => React.useSyncExternalStore(notify => mainSelection.subscribe(notify), resolveActiveSessionId, () => null);
    // The roleplay UI is mounted at the application level, while agent preset
    // identity is already available in the native session-list projection. Do
    // not probe roleplay REST routes (or wake a session) merely because the user
    // selected a standard/minimal conversation. Unknown rows are treated as
    // non-roleplay until the native projection says otherwise; this prevents a
    // 404 storm during list refresh and keeps standard sessions untouched.
    const sessionPresetOf = (sessionId) => {
        if (!sessionId)
            return null;
        try {
            const row = sessionsService?.list?.getSnapshot?.()?.byId?.[sessionId];
            const preset = row?.projectionValues?.agentPreset ?? row?.agentPreset;
            return typeof preset === 'string' && preset.trim() ? preset.trim() : null;
        }
        catch {
            return null;
        }
    };
    const isRoleplaySession = (sessionId) => sessionPresetOf(sessionId) === 'roleplay';
    const style = document.createElement('style');
    style.setAttribute('data-plugin-css', 'dsh-roleplay-ui');
    style.textContent = ROLEPLAY_UI_CSS + MEMORY_RETRIEVAL_CSS + CARD_ADAPTATION_CSS;
    document.head.appendChild(style);
    ctx.effect(() => () => style.remove(), 'roleplay-ui: styles');
    const toast = createToastController(document);
    const runCommand = async (sessionId, line) => {
        const commands = ctx.get('remote.commands');
        if (commands === undefined) {
            const error = new Error('命令服务尚未就绪');
            toast('命令失败：' + errorMessage(error));
            return { ok: false, error };
        }
        try {
            // alpha.3 direct remote signature is (sessionId, line, images, signal?).
            // The third business argument is required and strictly validated as an
            // array: omitting it reports arity=2, while undefined is rejected as
            // invalid images. This matches the official composer implementation.
            const remoteResult = await commands.execute(sessionId, line, []);
            if (!remoteResult?.ok) {
                const code = remoteResult?.error?.code ? String(remoteResult.error.code) + ': ' : '';
                throw new Error(code + String(remoteResult?.error?.message ?? '远端命令调用失败'));
            }
            if (remoteResult.value === undefined)
                throw new Error('未知或格式错误的命令：' + line);
            const outcome = remoteResult.value?.result;
            if (outcome?.kind === 'error')
                throw new Error(String(outcome.text ?? '命令处理失败'));
            return { ok: true, value: outcome ?? remoteResult.value };
        }
        catch (error) {
            toast('命令失败：' + errorMessage(error));
            return { ok: false, error };
        }
    };
    // ── 共享状态缓存（/api/roleplay/state）─────────────────────────────────────
    const { fetchState, subscribeState, invalidateState, wakeSessionForState, peekState, stateVersion } = createRoleplayStateStore({
        sessionsService,
        isRoleplaySession
    });
    const { useTavernActivity, ActivityBanner, BackgroundNotesBanner, pendingPlayerBubble, DeferredPlayerInput } = createActivityComponents({
        React,
        isRoleplaySession,
        peekState
    });
    if (slots !== undefined)
        slots.inject('conversation.chat.roleplay-progress', () => slots.register({ name: 'conversation.chat.roleplay-progress', id: 'roleplay-progress', order: 10, inject: sessionId => ({ sessionId }) }, DeferredPlayerInput));
    const { saveState, runMaintenance, replaceMessage, forkAndPrompt, forkWithoutUserTurn, openNativeBranch, retryBranchMutation } = createRoleplayActions({
        sessionsService,
        workspacesService,
        openSession: id => navigation.openSession(id),
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
            return v === null ? true : v === '1';
        }
        catch {
            return true;
        }
    };
    const applyImmersive = (on) => {
        if (typeof document === 'undefined')
            return;
        document.body.classList.toggle('rp-immersive', on);
        try {
            localStorage.setItem(IMMERSIVE_KEY, on ? '1' : '0');
        }
        catch { }
    };
    // ── 消息操作行：版本翻页 + 重新生成/导出（仅 roleplay 会话渲染；
    //     分支复用原版自带按钮）─────────────────────────────────────────────
    // Lucide 风格内联图标（ISC 许可的开放路径，stroke=currentColor）
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
    if (slots !== undefined) {
        slots.inject('conversation.chat.roleplay-failure-actions', () => slots.register({
            name: 'conversation.chat.roleplay-failure-actions', id: 'roleplay-failure-actions', order: 30,
            inject: sessionId => ({ sessionId }),
        }, AssistantActions));
        slots.inject('conversation.chat.assistant-actions', () => slots.register({
            name: 'conversation.chat.assistant-actions',
            id: 'roleplay-actions',
            order: 30,
            inject: (sessionId) => ({ sessionId }),
        }, AssistantActions));
        slots.inject('conversation.chat.user-actions', () => slots.register({
            name: 'conversation.chat.user-actions',
            id: 'roleplay-user-actions',
            order: 30,
            inject: (sessionId) => ({ sessionId }),
        }, UserActions));
    }
    const UserInfoSettings = createUserInfoSettings({ React, toast });
    // ── 原生 sidebar slot 驱动的单一角色扮演管理面板 ──────────────────────────
    {
        const sessionDrafts = new Map();
        const jsonFetch = async (url, init) => {
            const response = await fetch(url, init);
            const data = await response.json();
            if (!response.ok || data?.ok === false) {
                const error = Object.assign(new Error(data?.error ?? `请求失败 ${response.status}`), { code: data?.code, details: data?.details });
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
            ['cards', '人物设定', CardsPanel],
            ['worldbook', '世界书', WorldbookPanel],
            ['memory', '记忆', MemoryPanel],
            ['core-rules', '核心设定', CoreRulesPanel],
            ['plot-guidance', '剧情指引', PlotGuidancePanel],
            ['style-specialization', '文风特化', StyleSpecializationPanel],
            ['settings', '自定义规则', SettingsPanel],
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
        function RoleplayManager({ sessionId, onClose }) {
            const draftKey = `${sessionId ?? 'none'}:panel`;
            const savedDraft = sessionDrafts.get(draftKey) ?? {};
            const [tab, setTabRaw] = React.useState(typeof managerState.requestedTab === 'string' ? managerState.requestedTab : (typeof savedDraft.tab === 'string' ? savedDraft.tab : 'cards'));
            const setTab = (next) => {
                const previous = sessionDrafts.get(draftKey) ?? {};
                updatePanelDraft(sessionDrafts, sessionId, 'panel', { tab: next, version: Number(previous.version ?? 0) + 1 });
                setTabRaw(next);
            };
            const roleplay = isRoleplaySession(sessionId);
            React.useEffect(() => {
                const onNeedsConfig = (event) => {
                    const detail = event.detail;
                    if (detail?.sessionId && detail.sessionId !== sessionId)
                        return;
                    if (detail?.action !== 'configure-adaptation-model')
                        return;
                    setTab('card-adaptation');
                };
                window.addEventListener('dsh-roleplay-needs-config', onNeedsConfig);
                return () => window.removeEventListener('dsh-roleplay-needs-config', onNeedsConfig);
            }, [sessionId]);
            const dialogRef = React.useRef(null);
            React.useLayoutEffect(() => {
                const dialog = dialogRef.current;
                if (!dialog)
                    return;
                try {
                    if (!dialog.matches?.(':modal')) {
                        if (dialog.open)
                            dialog.close?.();
                        dialog.showModal?.();
                    }
                }
                catch { }
                return () => {
                    if (dialog.open)
                        dialog.close?.();
                };
            }, []);
            const dialogProps = {
                ref: dialogRef,
                className: 'dsh-rp-dialog',
                onCancel: (event) => {
                    event.preventDefault();
                    onClose();
                }
            };
            if (!roleplay || !sessionId)
                return React.createElement('dialog', dialogProps, React.createElement('div', { className: 'dsh-rp-muted' }, '当前会话不是角色扮演会话'), React.createElement('button', { className: 'dsh-rp-btn', onClick: onClose }, '关闭'));
            const selected = panelTabs.find(([id]) => id === tab);
            const Body = selected?.[2] ?? CardsPanel;
            const primaryTabs = [
                ['core-rules', '核心设定'],
                ['cards', '人物设定'],
                ['worldbook', '世界书'],
                ['plot-guidance', '剧情指引'],
                ['style-specialization', '文风特化'],
                ['settings', '自定义规则'],
                ['memory', '记忆'],
                ['character-cluster', '角色集群'],
                ['card-adaptation', '长文本转角色卡']
            ];
            const secondaryTabs = [
                ['presets', '预设'],
                ['resources', '资源库'],
                ['models', '模型'],
                ['embedding', 'Embedding 模型设置'],
                ['usage', '使用统计'],
                ['export', '导出'],
                ['userinfo', '用户信息'],
                ['logs', '日志']
            ];
            const tabButton = ([id, label]) => React.createElement('button', {
                className: 'dsh-rp-btn',
                key: id,
                'aria-current': tab === id ? 'page' : undefined,
                'aria-selected': tab === id,
                onClick: () => setTab(id)
            }, label);
            const tabs = React.createElement('nav', { className: 'dsh-rp-dialog-tabs' }, React.createElement('div', { className: 'dsh-rp-dialog-tab-row' }, primaryTabs.map(tabButton)), React.createElement('div', { className: 'dsh-rp-dialog-tab-divider', 'aria-hidden': 'true' }), React.createElement('div', { className: 'dsh-rp-dialog-tab-row' }, secondaryTabs.map(tabButton)));
            // Each tab renders one panel; keep special props next to that panel.
            const body = (() => {
                switch (tab) {
                    case 'card-adaptation':
                        return React.createElement(CardAdaptationPanel, {
                            key: sessionId + ':card-adaptation',
                            sessionId,
                            focusModelSettings: managerState.requestedTab === 'card-adaptation',
                            focusModelSettingsNonce: managerState.requestedFocusNonce ?? 0,
                        });
                    case 'presets':
                        return React.createElement(PresetPanel, { key: `${sessionId}:presets`, sessionId });
                    case 'character-cluster':
                        return React.createElement(CharacterClusterPanel, { key: `${sessionId}:character-cluster`, sessionId });
                    case 'logs':
                    case 'usage':
                        return React.createElement(TelemetryPanel, { key: `${sessionId}:${tab}`, sessionId, mode: tab });
                    case 'userinfo':
                        return React.createElement('div', { className: 'dsh-rp-panel' }, React.createElement(UserInfoSettings));
                    case 'models':
                        return React.createElement(ModelPanel, { key: `${sessionId}:models`, sessionId });
                    case 'embedding':
                        return React.createElement(EmbeddingPanel, { key: `${sessionId}:embedding`, sessionId });
                    case 'resources':
                        return React.createElement(ResourcesPanel, { key: `${sessionId}:resources`, sessionId });
                    case 'export':
                        return React.createElement(ExportPanel, { key: `${sessionId}:export`, sessionId });
                    case 'memory':
                        return React.createElement(MemoryRetrievalMemoryPanel, {
                            key: `${sessionId}:${tab}`, sessionId, LegacyPanel: MemoryPanel,
                        });
                    default:
                        return React.createElement(Body, { key: `${sessionId}:${tab}`, scope: { sessionId }, visible: true });
                }
            })();
            return React.createElement('dialog', dialogProps, React.createElement('div', { className: 'dsh-rp-dialog-head' }, React.createElement('strong', null, '酒馆管理'), React.createElement('button', { className: 'dsh-rp-btn', onClick: onClose }, '关闭')), tabs, body);
        }
        function ManagerEntry({ useSessions }) {
            const currentSessionId = useMainSessionId();
            React.useEffect(() => {
                if (managerState.open && managerState.sessionId !== currentSessionId) {
                    managerState = { ...managerState, sessionId: currentSessionId };
                    renderManager();
                }
            }, [currentSessionId]);
            return null;
        }
        let managerState = {
            sessionId: null,
            open: false
        };
        const managerHost = document.createElement('div');
        document.body.appendChild(managerHost);
        const managerRoot = require('react-dom/client').createRoot(managerHost);
        const renderManager = () => managerRoot.render(managerState.open
            ? React.createElement(React.Fragment, null, React.createElement(ManagerEntry, { useSessions: managerState.useSessions }), React.createElement(RoleplayManager, {
                key: `${managerState.sessionId}:${managerState.open}`,
                sessionId: managerState.sessionId,
                onClose: () => {
                    managerState.open = false;
                    renderManager();
                }
            }))
            : null);
        const openManager = (sessionId, useSessions, requestedTab, requestedFocusNonce = 0) => {
            managerState = { sessionId, useSessions, open: true, requestedTab, requestedFocusNonce };
            renderManager();
        };
        const onNeedsConfig = (event) => {
            const detail = event.detail;
            if (detail?.forwarded || detail?.action !== 'configure-adaptation-model' || !detail?.sessionId)
                return;
            if (managerState.open) {
                managerState.requestedTab = 'card-adaptation';
                managerState.requestedFocusNonce = (managerState.requestedFocusNonce ?? 0) + 1;
                renderManager();
                window.dispatchEvent(new CustomEvent('dsh-roleplay-needs-config', { detail: { ...detail, forwarded: true } }));
            }
            else
                openManager(detail.sessionId, undefined, 'card-adaptation', 1);
        };
        window.addEventListener('dsh-roleplay-needs-config', onNeedsConfig);
        ctx.effect(() => () => window.removeEventListener('dsh-roleplay-needs-config', onNeedsConfig), 'roleplay-ui: adaptation model notice');
        ctx.effect(() => () => {
            managerRoot.unmount();
            managerHost.remove();
        }, 'roleplay-ui: panel manager');
        const sidebarIcon = (kind) => React.createElement('svg', {
            viewBox: '0 0 16 16',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.3,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': true
        }, React.createElement('path', {
            d: kind === 'tavern'
                ? 'M2 7 8 2l6 5M3.5 6v7.5h9V6M6.5 13.5V9h3v4.5'
                : kind === 'decision' ? 'M2 2.5h12v9H8l-3.5 3v-3H2zM4.5 5.5h7M4.5 8h5' : 'M2 2.5h12v11H2zM10 2.5v11M4 5h3M4 8h3'
        }));
        // The workspace owner already loads primitives. Resolve its shared Tooltip
        // when this slot renders so native hover/focus behavior and theme stay exact.
        const sidebarTooltip = (props, label, button) => React.createElement(require('@deepseek-ai/dsh-client-ui-primitives').Tooltip, { label, side: props?.wide === false ? 'right' : 'bottom', delayMs: 500 }, button);
        const managerButton = (props) => {
            const sessionId = useMainSessionId();
            return sidebarTooltip(props, '酒馆管理', React.createElement('button', {
                type: 'button',
                className: 'dsh-rp-nav-entry',
                disabled: !isRoleplaySession(sessionId),
                'aria-label': '酒馆管理',
                onClick: () => openManager(sessionId, props.useSessions)
            }, React.createElement('span', { className: 'dsh-rp-nav-icon' }, sidebarIcon('tavern')), props?.wide === false ? null : React.createElement('span', { className: 'dsh-rp-nav-label' }, '酒馆管理')));
        };
        const statusModeButton = (props) => {
            const sessionId = useMainSessionId();
            return sidebarTooltip(props, '切换状态栏模式', React.createElement('button', {
                type: 'button',
                className: 'dsh-rp-status-toggle',
                disabled: !isRoleplaySession(sessionId),
                'aria-label': '切换状态栏模式',
                onClick: () => window.dispatchEvent(new Event('dsh-roleplay-status-mode'))
            }, sidebarIcon('status')));
        };
        const decisionButton = (props) => {
            const sessionId = useMainSessionId();
            return sidebarTooltip(props, '显示或隐藏决策卡', React.createElement('button', {
                type: 'button',
                className: 'dsh-rp-status-toggle',
                disabled: !isRoleplaySession(sessionId),
                'aria-label': '显示或隐藏决策卡',
                onClick: () => window.dispatchEvent(new Event('dsh-roleplay-decision-toggle'))
            }, sidebarIcon('decision')));
        };
        if (slots !== undefined) {
            slots.inject('sidebar.workspaces.before', () => slots.register({ name: 'sidebar.workspaces.before', id: 'roleplay-panel-entry', order: 20, inject: () => ({}) }, managerButton));
            slots.inject('sidebar.workspaces.header.action', () => slots.register({ name: 'sidebar.workspaces.header.action', id: 'roleplay-status-mode', order: 20, inject: () => ({}) }, statusModeButton));
            slots.inject('sidebar.workspaces.header.action', () => slots.register({ name: 'sidebar.workspaces.header.action', id: 'roleplay-decision-toggle', order: 21, inject: () => ({}) }, decisionButton));
        }
        // 沉浸开关：随当前会话 preset 自动应用（roleplay 默认开）
        const syncImmersive = (sessionId) => {
            if (!isRoleplaySession(sessionId)) {
                applyImmersive(false);
                return;
            }
            fetchState(sessionId).then((data) => {
                applyImmersive(data?.preset === 'roleplay' && readImmersive());
            }).catch(() => { });
        };
        // ── 状态栏悬浮窗（仅 roleplay 会话；可最小化）────────────────────────────
        const { decisionSeat, StatusOverlay } = createStatusSurface({
            React,
            createRoot: require('react-dom/client').createRoot,
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
        ctx.effect(() => () => decisionSeat.dispose(), 'roleplay-ui: composer decision seat');
        // ── 沉浸阅读视图（conversation.view 新视图；仅 roleplay 会话可用）────────
        // 渲染管线：正文正则 → HTML/Markdown → 未命中正则回退 → 作用域 CSS（默认
        // 奶油纸感 + 作者 CSS 追加）→ JS（渲染后沙箱脚本 + .f 点击填入委托）。
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
        // ReaderView is registered through the native conversation slot only
        // after the declaration is in scope; the previous outer registration built
        // into a reference to an undefined ReaderView while esbuild renamed this
        // block-local declaration to ReaderView2.
        if (slots !== undefined) {
            slots.inject('conversation.view', () => slots.register({
                name: 'conversation.view',
                id: 'roleplay-reader',
                order: 5,
                label: '酒馆',
                inject: (sessionId) => ({ sessionId }),
            }, ReaderView));
        }
        let overlaySessionId = null;
        let overlayRender = null;
        {
            const { createRoot } = require('react-dom/client');
            const overlayHost = document.createElement('div');
            document.body.appendChild(overlayHost);
            const root = createRoot(overlayHost);
            overlayRender = () => {
                root.render(React.createElement(React.Fragment, null, React.createElement(StatusOverlay, { key: overlaySessionId ?? 'no-session', sessionId: overlaySessionId }), overlaySessionId && isRoleplaySession(overlaySessionId)
                    ? React.createElement(RebuildPrompt, { key: `rebuild:${overlaySessionId}`, sessionId: overlaySessionId })
                    : null));
            };
            overlayRender();
            ctx.effect(() => () => {
                root.unmount();
                overlayHost.remove();
            }, 'roleplay-ui: status overlay');
        }
        // A released main view clears its overlays, even if a sidebar retains B.
        let lastSessionId = null;
        const onMainSelection = () => {
            const sid = resolveActiveSessionId();
            if (sid === lastSessionId)
                return;
            lastSessionId = sid;
            if (sid)
                syncImmersive(sid);
            else
                document.body.classList.remove('rp-immersive');
            overlaySessionId = sid;
            overlayRender?.();
        };
        onMainSelection();
        ctx.effect(() => mainSelection.subscribe(onMainSelection), 'roleplay-ui: main view watch');
        ctx.effect(() => () => document.body.classList.remove('rp-immersive'), 'roleplay-ui: immersive state');
    }
}
