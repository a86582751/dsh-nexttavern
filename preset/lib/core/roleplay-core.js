// Generated from runtime/alpha3/src/core/roleplay-core.ts; edit the TypeScript source.
import { readProjectedStory } from './roleplay-message-view.js';
import { keyOf, textOf, durableSeq, provenanceSeq, sha256, safeId, cloneRecord, passthroughSchema, rollsSchema, } from './roleplay-data.js';
import { eventsOf, sessionEventsIfReady, surfaceEvents, surfaceEntries, isCompletedTurnEnd, canonicalAssistantForTurn, recentWindowSince, roleplayWindowCutStartIndex, assertWorkspaceSession, } from './roleplay-context.js';
import { decodeTaskSelection } from './tavern-task-primitives.js';
import { adaptationIsActive } from '../memory/memory-provenance.js';
export { createStableRoleplayFence, readRoleplayActivity, retireRoleplayContexts, recentWindowSince, retainRoleplayWindowContinuity, roleplayWindowCutStartIndex, } from './roleplay-context.js';
// roleplay-core.js — DeepSeek Harness roleplay preset 编排核心。
//
// 本文件是 preset 自带插件（agent.cordis.yml 以相对路径 './lib/roleplay-core.js'
// 挂载）。重要约束：preset 目录内的插件文件不能裸 import 任何 npm 包
// （preset 目录不在任何 node_modules 的向上解析路径上），只能：
//   1. import node: 内置模块；
//   2. 通过 inject 消费宿主服务。
//
// 提供的服务（本 preset isolate group 内）：
//   roleplay — 供 roleplay-memory-engine / 未来 UI 半使用：
//     surfaceText(sessionId, seqs)   -> 指定 seq 的表面节点原文
//     lockedFacts(branchId)          -> 不可丢失事实（锁定卡片/世界书条目）
//     memoryHead(branchId)           -> 记忆账本头部
//     memoryUpdate(branchId, patch)  -> 记忆账本更新（版本 +1）
//     sceneCurrent(branchId)         -> 当前场景快照
//     branchLineage(session)         -> 分支血缘（父链 + seedLength）
import { resolve } from 'node:path';
import { registerRoleplayImports, importActiveKey } from './roleplay-import.js';
import { internalTaskSeqs } from './tavern-tasks.js';
import { createNovelExports } from './novel-export.js';
import { createTelemetry } from './tavern-telemetry.js';
import { createMemoryRetrieval } from '../memory/memory-retrieval.js';
import { createPriceCatalog, createExchangeRates } from './tavern-pricing.js';
import { createRoleplayWorldlines } from './roleplay-worldlines.js';
import { createRoleplayStatus } from './roleplay-status.js';
import { createRoleplayPreparation } from './roleplay-preparation.js';
import { createRoleplayCompletion } from './roleplay-completion.js';
import { createRoleplayDecision, taskCancellation } from './roleplay-decision.js';
import { createRoleplayInheritance } from './roleplay-inheritance.js';
import { createResourceBridge } from './roleplay-resource-bridge.js';
import { createCardWorkflows } from './roleplay-card-workflow.js';
import { createRoleplayService } from './roleplay-service.js';
import { createSessionHistory, ensureSessionHistory } from './session-history.js';
import { createRoleplayTaskHost } from './roleplay-task-host.js';
import { registerRoleplayLoop } from './roleplay-loop.js';
import { retrieveWorldbook, taskDependenciesCurrent, buildDecisionContext, lockedFactsOf, authorUserValues, registerAuthorPrompts, residentAuthorContext, } from './roleplay-author-context.js';
import { registerAuthorTools } from './roleplay-author-tools.js';
import { registerSessionTools, registerSessionCommands } from './roleplay-session-actions.js';
import { simpleTool, registerTaskTools } from './roleplay-task-tools.js';
import { createRoleplayState } from './roleplay-state.js';
import { registerRoleplayDiagnosis } from './roleplay-diagnosis.js';
import { registerCardAuthoring, registerDraftCheck } from './roleplay-authoring.js';
import { registerAdaptationTools } from './card-adaptation-tools.js';
import { registerSettingsRoutes } from './roleplay-settings-routes.js';
import { createNarrativePresets, registerNarrativePresetTool } from './narrative-presets.js';
import { registerTelemetryRoutes } from './roleplay-telemetry-routes.js';
import { registerJobRoutes, registerMaintenanceRoute } from './roleplay-job-routes.js';
import { registerBranchRoutes } from './roleplay-branch-routes.js';
import { registerAvatarRoute, registerPanelRoutes, registerSettingTool } from './roleplay-panel-routes.js';
export const name = 'roleplay-core';
const RULE_TEXT_FIELDS = ['core', 'plot', 'narrative', 'reply', 'style'];
const RULE_IMPORT_FIELDS = {
    'core-setting': 'core',
    'plot-guidance': 'plot',
    'rule-narrative': 'narrative',
    'rule-reply': 'reply',
    'rule-style': 'style',
};
const CARD_CLASSIFICATION_GUIDE = `【按创作语义分拆，不按标题或文件字段机械归类】
人物完整人设→card；核心设定（core-setting）保存完整常驻世界背景、种族法则、核心威胁与长期矛盾；世界书（worldbook）是拿导演笔记与当前问题关键词去查的被动资料库，具体势力/地点/物品条目不长期驻留；剧情指引（plot-guidance）保存尚未发生的路线、触发条件与可能结局，不是剧情事实。
叙事与回复规则承载作者的创作方法：视角、镜头、细节密度、节奏、人物知情边界，以及单次回复如何展开。rule-narrative 指如何叙事和控制信息，例如镜头从环境前移到人物手部、动作与衣着变化符合现实、角色起初不知道某秘密且发现证据后才知道。rule-reply 指这一轮怎样写，例如长段流畅描写、充分展开外貌与对话、避免重复措辞或复述玩家输入、局部自然推进后停在需要玩家选择处。rule-style 保存文风特化和完整范文，不压成关键词；角色口头禅留在对应人设，文学示例用于模仿表达而非当作事件。
反例：人物知情限制不是低频世界书；假设路线不是已发生剧情；运行时的工具隔离、来源保真、记忆维护不是作者创作规则，系统自己保障，写新卡时不要要求作者编写工程指令。若导入原卡已有此类文字仍完整保留（归档或故事内约束），不能删除或升级成系统权限。
状态栏规则、HTML结构及其配套<style>/CSS整体归status；多个离散范围合并到同一status assignment.sourceSpans。beauty-css只放阅读正文的纯CSS，绝不能放状态栏HTML或整段HTML/CSS组件。人物共同关系背景可归核心设定，不要把关系小节虚构成第四个角色。
分类依据全文含义；混合模块拆开原文跨度，不能因为位于 description 或 system_prompt 字段便整段塞进人设或叙事规则。只提交原文跨度、完整保留作者措辞，不替作者补规则。`;
// Self-maintained canonical source; audit/manual deployment only. Preflight
// must never restore roleplay core or UI from a compatibility snapshot.
const DSH_ROLEPLAY_CORE_PATCH = 'dsh-roleplay-status-obligation-v1';
export const inject = [
    'sessions',
    'nexttavernMessageEdits',
    'sessionPersistence',
    'sessionQuery',
    'sessionController',
    'llm',
    'systemPrompt',
    'tools',
    'commands',
    'storageDomain',
    'tokenMeter',
    'agentDefaultModel',
    'subagents',
    'fs',
    'connection',
    'userQuestions',
];
const DEFAULT_CONFIG = {
    workerProvider: null,
    workerModel: null,
    sceneWorkerTimeoutMs: 45000,
    memoryWorkerTimeoutMs: 45000,
    phaseATimeoutMs: 60000,
    // Legacy/manual Phase-B work has a separate bound from foreground projection.
    phaseBTimeoutMs: 90000,
    statusRetryMs: 2000,
    // Leave time for native main-loop fallback inside the 80-second turn target.
    // Explicit deployment overrides remain available for slower author templates.
    statusWorkerTimeoutMs: 45000,
    decisionWorkerTimeoutMs: 45000,
    maxWorldTokens: 6000,
    windowTokens: 24000,
    // Roleplay uses a hard prompt rollover with a continuity tail.  The full
    // event log remains immutable; only the model-visible story body slides.
    contextWindowTokens: 230000,
    continuityTailTokens: 18000,
    contextWindowEnabled: true,
    concurrencyCap: 2,
    workerTemperature: 0.4,
    workerMaxTokens: 2048,
};
const DOMAIN_NAME = 'roleplay';
const DOMAIN_VERSION = 1;
// Native task transport. Same-model work yields to the existing Agentic Loop.
async function llmJson(ctx, route, options) {
    const result = await ctx.get('roleplay').nativeTask({ ...options, ...route, format: 'json' });
    const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (result === null || isRecord(result))
        return result;
    throw new Error('任务没有返回 JSON 对象');
}
// ── 世界书检索（纯本地，确定性）──────────────────────────────────────────────
export { retrieveWorldbook, taskDependenciesCurrent, buildDecisionContext } from './roleplay-author-context.js';
// ── 工作提示词（worker 系统提示）────────────────────────────────────────────
const LEDGER_WORKER_SYSTEM = '你是角色扮演工作台的正史记录员。根据本轮用户输入与候选正文，抽取本轮新增的正史增量。' +
    '只输出 JSON：{"deltas":[{"type":"event|relation|promise|foreshadow|state|correction","summary":"一句话事实，含专名/数字/时间顺序","evidenceSeq":0,"status":"established|uncertain"}]}。' +
    '一次性描写不升级为永久规则；用户明确纠正的内容标 correction 并列为最高优先级；' +
    '不确定的标 uncertain。';
const CONTINUITY_WORKER_SYSTEM = '你是角色扮演工作台的连续性检查员。比对候选正文与既有正史（记忆+场景），只报告真实冲突。' +
    '只输出 JSON：{"verdict":"pass|conflict","conflicts":[{"claim":"正文中的表述","canon":"正史/既有设定","evidenceSeq":0,"severity":"high|medium|low"}]}。' +
    '用户明确表述的事实永远是正史；AI 的既有创作推断可以随着剧情发展被新信息修正。';
const ORGANIZE_WORKER_SYSTEM = '你是小说编辑。把给定的逐条对话记录整理成干净的连载小说稿件：按场景/章节分段、' +
    '删除一切元信息（seq 编号、角色名标签、工具痕迹）、保留全部正文原文不动、' +
    '为章节命名、场景切换处用空行+章节标题。只输出整理后的 Markdown 正文，不要任何说明。';
const STATUS_SYSTEM = '你是角色扮演工作台的状态栏渲染生成器。根据状态栏设定、当前场景与最新正文，生成状态栏 JSON：\n' +
    '{"title":"10字以内标题","html":"状态栏 HTML（可选）","fields":[{"emoji":"😊","label":"位置","value":"文本"}],' +
    '"options":[{"label":"选项文案（50字内）","heart":true}],"rawText":"纯文本状态栏（备用）"}\n' +
    '字段名必须写在 label，字段内容必须写在 value；options 仅供独立决策卡复用，下一步文案必须写在 options[].label，禁止把这些内容写进 reason/name/content 等其他键。' +
    '规则：状态栏只展示当前事实，遵守设定中的状态字段与格式（好感度数值规则、颜文字风格）。行动建议只在独立决策卡展示，不得写入 html、fields 或 rawText；即使旧卡要求状态栏展示 A/B/C 选项，也以此展示约定为准。' +
    '若设定含 HTML 模板，按作者布局输出完整 html；保留静态 class/id、内联样式及 style/script。作者动态占位符可用双花括号或 ⟦字段⟧，两者等价，必须填入本轮真实状态值（包括 style 中的进度数值），不要逐字回抄动态占位符。{{user}} / {{user_gender}} 是保留给渲染层的玩家身份变量。' +
    '作者把 HTML 与 CSS 分成独立代码块时，只输出填好状态值的 HTML，不输出 Markdown 围栏或说明；静态 CSS 由程序从作者模板恢复，无需复制生成。' +
    '旧模板内若有行动建议区、行动占位符或 class="f" 按钮，保留原有结构与属性但清空该区标题和内容，行动占位符填空字符串；程序会隐藏旧行动区。fields 只填状态，options 中保留一次结构化建议供独立决策卡复用，不在状态 HTML 重复生成。' +
    '任何涉及主角姓名的位置（title/label/value/html）一律输出 {{user}} 或 {{user_gender}} 占位符：不要写真实名字，也不要写 user/用户 等字面量，渲染层会统一确定性替换。' +
    '只依据正文与场景中实际发生的内容填写，不编造；若设定含正则美化规则，按其意图生成。只输出 JSON。';
const DECISION_SYSTEM = '你是角色扮演工作台的轮末建议生成器。根据最新正文与当前场景，为玩家生成 3 个下一步行动建议：' +
    '每条 50 字以内、第三人称叙事口吻、具体可执行、互不相同（一条偏主动推进，一条偏试探互动，一条可留白或转移场景）；' +
    '可加好感的选项 heart=true。选项文案必须放在 label，禁止放进 reason/name/content。只输出 JSON：{"options":[{"label":"…","heart":false}]}，不要输出任何其他文字。';
// ── 插件主体 ────────────────────────────────────────────────────────────────
export async function apply(ctx, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...(config ?? {}) };
    const history = createSessionHistory({
        get: id => ctx.sessions.get(id),
        observe: (id, options) => ctx.sessionQuery.observeSession(id, options),
    });
    // Register the feed before any asynchronous observation. session/created is
    // fire-and-forget; agent/created is the awaited gate before the first step.
    ctx.on('session/event', history.accept, { global: true, prepend: true });
    ctx.on('session/disposed', history.disposeSession, { global: true });
    ctx.on('agent/created', async ({ agent, signal }) => {
        await history.ready(agent.session, signal);
        return undefined;
    }, { global: true, prepend: true });
    ctx.effect(() => history.dispose, 'roleplay: session history');
    // `sessions` contains only Agents currently retained by the Host. Opening a
    // persisted conversation directly into Reader after a service restart does
    // not necessarily retain its Agent first, so REST callers must use the Host
    // Session API to resume exactly the Session they address. This is activation,
    // not generation: no prompt is sent and unselected sibling branches stay cold.
    async function resolveRoleplaySession(sessionId) {
        const id = String(sessionId ?? '').trim();
        if (!id)
            return null;
        let session = ctx.sessions.get(id);
        if (!session) {
            try {
                const found = await ctx.sessionController.resolveAgent(id);
                session = found && !('error' in found)
                    ? found.agent?.session ?? ctx.sessions.get(id)
                    : null;
            }
            catch (error) {
                try {
                    ctx.logger?.warn?.(`roleplay: failed to resume Session ${id}: ${String(error instanceof Error ? error.message : error)}`);
                }
                catch { }
                return null;
            }
        }
        if (session)
            await ensureSessionHistory(session);
        return session && isRoleplaySession(session) ? session : null;
    }
    // per-session 运行时状态（standing mount 被同一 preset 的多个会话共享）
    const sessions = new Map(); // sessionId -> runtime state
    // Decision cards are produced by an asynchronous worker while the browser
    // may answer (or a new turn may supersede them).  Serialize every read/
    // modify/write for one branch so a late worker can never resurrect an
    // already answered card.
    const decisionMutationLocks = new Map();
    async function withDecisionMutationLock(branchId, work) {
        const key = String(branchId);
        const prior = decisionMutationLocks.get(key) ?? Promise.resolve();
        let release;
        const gate = new Promise((resolveGate) => {
            release = resolveGate;
        });
        const queued = prior.catch(() => { }).then(() => gate);
        decisionMutationLocks.set(key, queued);
        await prior.catch(() => { });
        try {
            return await work();
        }
        finally {
            release();
            if (decisionMutationLocks.get(key) === queued)
                decisionMutationLocks.delete(key);
        }
    }
    // 持久域（每分支一条记录；per-record 布局）
    const domain = await ctx.storageDomain.open({
        name: DOMAIN_NAME,
        version: DOMAIN_VERSION,
        layout: 'per-record',
        tables: {
            branch: { valueSchema: passthroughSchema() },
            cards: { valueSchema: passthroughSchema() },
            worldbook: { valueSchema: passthroughSchema() },
            memory: { valueSchema: passthroughSchema() },
            scene: { valueSchema: passthroughSchema() },
            rolls: { valueSchema: rollsSchema() },
            status: { valueSchema: passthroughSchema() },
            rules: { valueSchema: passthroughSchema() },
            opening: { valueSchema: passthroughSchema() },
            drafts: { valueSchema: passthroughSchema() },
            userinfo: { valueSchema: passthroughSchema() },
            decision: { valueSchema: passthroughSchema() },
        },
    });
    const T = {
        branch: domain.table('branch'),
        cards: domain.table('cards'),
        worldbook: domain.table('worldbook'),
        memory: domain.table('memory'),
        scene: domain.table('scene'),
        rolls: domain.table('rolls'),
        status: domain.table('status'),
        rules: domain.table('rules'),
        opening: domain.table('opening'),
        drafts: domain.table('drafts'),
        userinfo: domain.table('userinfo'),
        decision: domain.table('decision'),
    };
    const taskAgents = new Map();
    const priceCatalog = createPriceCatalog({ table: T.branch });
    const exchangeRates = createExchangeRates({ table: T.branch });
    const telemetry = createTelemetry({
        table: T.branch,
        sessions: ctx.sessions,
        query: ctx.sessionQuery,
        jobs: () => [...T.branch.entries()]
            .filter(([key]) => key.startsWith('tavern_job__')
            || key.startsWith('tavern_cardjob__')
            || key.startsWith('tavern_novel__'))
            .map(([, value]) => value),
    });
    // Observe every supported native LLM entry, including retries, regeneration,
    // auxiliary calls and child sessions. Never filter by current story surface.
    ctx.on('llm/stream', (options, next) => telemetry.observe(options, next), { global: true });
    ctx.on('session/event', (session, event) => {
        if (['turn/end', 'tool/result', 'compaction/end'].includes(event?.type)) {
            void telemetry.ingest(session).catch(() => { });
        }
    }, { global: true });
    ctx.effect(() => {
        const tick = () => {
            if (telemetry.prices().autoSync)
                priceCatalog.refresh();
        };
        tick();
        const timer = setInterval(tick, 6 * 60 * 60 * 1000);
        timer.unref?.();
        return () => clearInterval(timer);
    }, 'roleplay: automatic price catalog refresh');
    ctx.effect(() => {
        const tick = () => {
            if (exchangeRates.state().fetchedAt)
                exchangeRates.refresh();
        };
        tick();
        const timer = setInterval(tick, 60 * 60 * 1000);
        timer.unref?.();
        return () => clearInterval(timer);
    }, 'roleplay: daily exchange rate refresh');
    const { libraryFor, resourceName, archiveImported, migrateResources } = createResourceBridge({ T });
    const { sameModelRoute, canonicalModelRoute, executedMainRoute, modelPolicy, taskStory, characterCluster, characterRoster, clusterLoreVisible, clusterPhase, clusterJob, tavernTasks, nativeTask, resumeMemoryWork, resumeStatusMaintenance, } = createRoleplayTaskHost({
        T,
        ctx,
        config,
        taskAgents,
        STATUS_SYSTEM,
        DECISION_SYSTEM,
        ORGANIZE_WORKER_SYSTEM,
        taskDependenciesCurrent,
        storyBranchIsActive: (...args) => storyBranchIsActive(...args),
        statusFixedContext: (...args) => statusFixedContext(...args),
        taskInstruction: (...args) => taskInstruction(...args),
        getMaintenanceJob: id => maintenanceJobs.get(id),
        runStatusObligation: (...args) => runStatusObligation(...args),
    });
    const novelExports = createNovelExports({
        table: T.branch,
        history: session => {
            const engine = ctx.get('compaction');
            if (typeof engine?.storyEvidence !== 'function') {
                throw new Error('完整剧情历史服务尚未就绪，请稍后重试导出');
            }
            return engine.storyEvidence(session);
        },
        request: spec => nativeTask({
            ...spec,
            selection: decodeTaskSelection(spec.selection),
        }),
        archive: async (session, job, markdown) => {
            assertWorkspaceSession(session);
            const lib = libraryFor(session);
            const resource = await lib.archive({
                name: resourceName(job.plan.title),
                type: 'text/markdown',
                bytes: Buffer.from(markdown, 'utf8'),
                source: {
                    sessionId: session.id,
                    kind: 'novel-export',
                    jobId: job.id,
                    sourceHash: job.sourceHash,
                },
            });
            return lib.metadata(resource.id);
        },
    });
    async function resumeNovelExports(session, agent, signal) {
        const resumableJobs = novelExports
            .list(session)
            .filter(job => ['queued', 'running', 'waiting-main'].includes(job.status));
        for (const job of resumableJobs) {
            await novelExports.drive(session, job.id, agent, signal);
        }
    }
    const { cardWorkflowKey, cardWorkflows, activeCardWorkflow, assertCardWorkflow, beginCardWorkflow, resumeCardWorkflows, completeCardWorkflow, } = createCardWorkflows({
        T,
        storyBranchIsActive: (...args) => storyBranchIsActive(...args),
        modelPolicy,
        statusFixedContext: (...args) => statusFixedContext(...args),
        nativeTask,
        CARD_CLASSIFICATION_GUIDE,
        archiveImported,
        libraryFor,
        resourceName,
        tavernTasks,
        taskAgents,
        ctx
    });
    const { memorySettingsPolicy, contextWindowKey, cloneContextWindow, buildPhaseA, storyWindowSettings, memoryForContext, contextWindowFor, memorySettingFields, } = createRoleplayPreparation({
        T,
        ctx,
        assertStoryBranchActive: (...args) => assertStoryBranchActive(...args),
        cfg,
        svc: {
            awaitCommitted: (...args) => svc.awaitCommitted(...args),
            settings: (...args) => svc.settings(...args),
        },
        ensureBranch,
        reconcileCanonicalPlayerVariants: (...args) => reconcileCanonicalPlayerVariants(...args),
        buildForkLookupIndex: (...args) => buildForkLookupIndex(...args),
        userValues: (...args) => userValues(...args),
        selectedStatusRecord: (...args) => selectedStatusRecord(...args)
    });
    // storage-domain get() returns an immutable logical snapshot.  Always clone
    // before preparing a changed record so a failed put cannot leak mutations.
    const cloneBranchRecord = (value) => value == null ? value : structuredClone(value);
    // The model and older roleplay records use several aliases for the same
    // status-bar fields. Normalize at the boundary so storage, workers, and UI
    // all see one stable shape without rewriting historical records in place.
    const { statusFixedContext, runStatusObligation, textAlias, normalizeDecisionRecord, normalizeStatusOption, selectedStatusRecord, statusSource, normalizeStatusRecord, queueStatusObligation, statusRunStartSeq, recoverStatusObligations, statusRecoveredSessions, selectedStatusGeneration, latestStatusEvent, } = createRoleplayStatus({
        ctx,
        storyBranchIsActive: (...args) => storyBranchIsActive(...args),
        T,
        cloneBranchRecord,
        taskCancellation,
        ensureBranch,
        modelPolicy,
        sameModelRoute,
        retrieveWorldbook,
        cfg,
        llmJson,
        resolveRoute: (...args) => resolveRoute(...args),
        STATUS_SYSTEM,
        DEFAULT_CONFIG,
        importRecordKey: (...args) => importRecordKey(...args),
        spanText: (...args) => spanText(...args)
    });
    const userValues = (branchId) => authorUserValues(T, branchId, textAlias);
    // domain 生命周期归本 fiber：卸载/失败挂载时必须 close，否则域名泄漏、
    // 重挂载会撞上 "already open"。
    ctx.effect(() => () => domain.close(), 'roleplay: close domain');
    const ensureState = (sessionId) => {
        let st = sessions.get(sessionId);
        if (!st) {
            st = {
                sessionId,
                lastPreparedTurn: -1,
                pendingTurn: null,
                snapshot: null,
                pendingScene: null,
                // A single agent can drain several queued turns before it becomes
                // idle. Keep one immutable Phase-A snapshot per turn; the legacy
                // scalar fields remain as a compatibility fallback for old hooks.
                snapshots: new Map(),
                pendingScenes: new Map(),
                phaseBStarted: new Set(),
                phaseBRetryTimers: new Map(),
                phaseBAttempts: new Map(),
                recallGeneration: 0,
                commitChain: Promise.resolve(),
                branches: null,
                importPending: new Map(),
                branchReady: false,
                branchPreparing: null,
                regenerateAnchor: null,
            };
            sessions.set(sessionId, st);
        }
        return st;
    };
    const resolveRoute = (session, agent) => ({ session, agent: agent ?? taskAgents.get(session.id) });
    const isRoleplaySession = (session) => {
        if (!session)
            return false;
        const events = sessionEventsIfReady(session);
        if (events === null)
            return session.header?.agentPreset === 'roleplay';
        if (events.some(e => e?.type === 'subagent/descriptor' && Number(e.seq) >= Number(session.inheritedEventCount ?? 0)))
            return false;
        let preset = session.header?.agentPreset;
        for (const e of events) {
            if (e && e.type === 'agent-preset/selected' && e.data?.agentPreset)
                preset = e.data.agentPreset;
        }
        return preset === 'roleplay';
    };
    // ── 原生 Session 分支索引 ────────────────────────────────────────────────
    // 每个候选回复都是一个独立 Session；分支分页只保存很小的导航元数据，
    // 不复制兄弟分支正文。Harness 因而仍按当前 Session 尾页懒加载，模型、
    // 世界书检索和记忆也天然只看到当前选择的正史。
    const { storyBranchIsActive, assertStoryBranchActive, reconcileCanonicalPlayerVariants, buildForkLookupIndex, reconcileNativeFork, failPendingNativeFork, nativeBranchGroupsFor, nativePlayerGroupsFor, assistantMessageId, userForkContext, locatePlayerRecoveryTarget, failedForkMembership, isRecoverySourceMember, backfillRecoverySourceMember, deletedBranchMessageIdsFor, inheritedAssistantMessageIdsFor, withForkMutationLock, forkOperationKey, forkPointerFor, hydrateForkGroup, forkGroupKey, groupMemberForSession, locateForkTarget, bootstrapChildBranch, registerRecoveryFork, registerNativeFork, forkAnchorLockKey, requestUserEvent, forkPendingKey, replaceAssistantText, replaceUserText } = createRoleplayWorldlines({
        messageEdits: ctx.nexttavernMessageEdits,
        flushEdits: async (session) => {
            if (!await ctx.sessions.flush(session))
                throw new Error('会话编辑尚无持久化提供者，未提交派生状态');
        },
        ctx,
        safeId,
        keyOf,
        sha256,
        T,
        eventsOf,
        isCompletedTurnEnd,
        surfaceEvents,
        textOf,
        cloneBranchRecord,
        internalTaskSeqs,
        importActiveKey,
        resolveRoleplaySession,
        isRoleplaySession,
        ensureState,
        ensureBranch,
        durableSeq,
        canonicalAssistantForTurn,
        surfaceEntries,
        withDecisionMutationLock,
        normalizeDecisionRecord,
        cloneRecord,
        provenanceSeq
    });
    // ── 对外服务（供记忆引擎 / 未来 UI 半）─────────────────────────────────────
    const svc = createRoleplayService({
        nativeTask,
        storyBranchIsActive,
        ensureState,
        ctx,
        T,
        lockedFactsOf,
        cloneBranchRecord,
        memorySettingsPolicy,
        normalizeDecisionRecord,
        contextWindowKey,
        cloneContextWindow,
        normalizeStatusOption
    });
    const retrieval = createMemoryRetrieval({
        table: T.branch,
        record: call => telemetry.recordEmbedding(call),
        session: id => ctx.sessions.get(id),
        scopeOf: session => ctx.get('tavernConversations')?.rootOf(session.id) ?? session.id,
        list: async () => await ctx.sessionQuery?.listSessions?.() ?? [],
        read: async (id) => {
            const view = await readProjectedStory(ctx, id);
            return { session: view.header, events: view.events, view };
        },
        // Both live and cold inputs are native session logs; preserve their surface for tombstone checks.
        active: session => storyBranchIsActive(session),
    });
    Object.assign(svc, { retrieval });
    ctx.effect(() => () => retrieval.dispose(), 'roleplay: retrieval lifetime');
    ctx.on('session/created', session => retrieval.created(session), { global: true });
    ctx.on('session/event', async (session, event) => {
        if (['turn/end', 'user/message', 'compaction/end', 'roleplay/message-edit'].includes(event.type)) {
            await retrieval.changed(session);
        }
    }, { global: true });
    ctx.provide('roleplay', svc);
    // ── systemPrompt：{{user}}/{{user_gender}} 变量 + 角色卡 section ─────────────
    // 优先级：用户信息（设置页填写）> 玩家角色卡名 > 默认「用户」。
    const narrativePresets = createNarrativePresets(T.branch, id => ctx.get('tavernConversations')?.rootOf(id) ?? id);
    registerAuthorPrompts({
        ctx,
        T,
        isRoleplaySession,
        userValues,
        characterCluster,
        characterRoster,
        CARD_CLASSIFICATION_GUIDE,
        narrativePresets,
    });
    // ── 阶段 A：程序组装当前分支笔记与窗口；主代理按需查资料 ──────────────────
    const { preparationRecordKey, taskInstruction } = registerRoleplayLoop({
        authorContext: session => residentAuthorContext(T, session.id),
        adaptationScope: session => ctx.get('tavernConversations')?.rootOf(session.id) ?? session.id,
        importPromptCheckpoint: session => {
            const checkpoint = T.branch.get(importActiveKey(session.id));
            if (typeof checkpoint?.importId !== 'string'
                || typeof checkpoint.normalizedSha256 !== 'string')
                return null;
            return {
                importId: checkpoint.importId,
                normalizedSha256: checkpoint.normalizedSha256,
                opening: String(T.opening.get(keyOf(session.id, 'scene'))?.text ?? '没有作者开场，等待玩家行动。'),
            };
        },
        ctx,
        T,
        tavernTasks,
        clusterJob,
        isRoleplaySession,
        characterCluster,
        activeCardWorkflow,
        taskAgents,
        ensureState,
        clusterPhase,
        withDecisionMutationLock,
        normalizeDecisionRecord,
        resumeStatusMaintenance,
        resumeMemoryWork,
        resumeCardWorkflows,
        resumeNovelExports, buildPhaseA, characterRoster, storyWindowSettings, runStatusObligation,
        withImportLock: (...args) => withImportLock(...args),
        publishTurnDecision: (...args) => publishTurnDecision(...args),
        runPhaseBC: (...args) => runPhaseBC(...args),
    });
    // ── 阶段 B/C：正文出现后并行抽取 + 单写者提交 ──────────────────────────────
    function isLatestVisibleTurn(session, turnId, assistantSeq) {
        // Raw logs retain shadowed sibling turns. “Latest” for a decision card is
        // the latest completed assistant on the selected surface, not the last
        // turn/start in that audit log.
        const entries = surfaceEntries(session);
        const current = entries.find((entry) => entry.kind === 'assistant'
            && Number(entry.seq) === Number(assistantSeq)
            && Number(entry.turn) === Number(turnId));
        if (!current)
            return false;
        return !entries.some((entry) => entry.kind === 'assistant' && Number(entry.seq) > Number(current.seq));
    }
    // Publish choices after durable prose, independently of the slower notes
    // scheduler. Required work can run while the native story turn is stopping.
    const { publishTurnDecision, generateTurnDecision } = createRoleplayDecision({
        withDecisionMutationLock,
        normalizeDecisionRecord,
        T,
        taskStory,
        isStale: (...args) => isStale(...args),
        isLatestVisibleTurn,
        statusSource,
        modelPolicy,
        selectedStatusRecord,
        sameModelRoute,
        normalizeStatusRecord,
        normalizeStatusOption,
        buildDecisionContext,
        memoryForContext,
        ctx,
        resolveRoute,
        llmJson,
        DECISION_SYSTEM,
        cfg,
        DEFAULT_CONFIG
    });
    const { runPhaseBC, isStale } = createRoleplayCompletion({
        storyBranchIsActive,
        T,
        cloneBranchRecord,
        reconcileNativeFork,
        ctx,
        resolveRoute,
        memoryForContext,
        publishTurnDecision,
        llmJson,
        LEDGER_WORKER_SYSTEM,
        cfg,
        CONTINUITY_WORKER_SYSTEM,
        contextWindowFor,
        contextWindowKey,
        svc,
        sessions,
        failPendingNativeFork,
        isRoleplaySession,
        queueStatusObligation,
        statusRunStartSeq,
        recoverStatusObligations
    });
    // ── 分支继承：原生 Session fork 的 seed 只复制会话事件，preset 私有域
    //    需要在子会话首次使用时惰性建立。卡片/规则属于创作配置，按 fork
    //    当下的活动版本继承；记忆/场景/状态属于剧情正史，必须裁到 seedLength，
    //    绝不能把父会话在分叉点之后发生的剧情泄漏到子分支。───────────────
    const { ensureBranch: initializeBranch, carryTruncationBoundary } = createRoleplayInheritance({
        ensureState,
        cloneBranchRecord,
        T,
        clusterLoreVisible,
        contextWindowKey,
        cloneContextWindow,
        ctx,
        statusSource,
        statusFixedContext,
        normalizeDecisionRecord
    });
    async function ensureBranch(session, options) {
        return initializeBranch(session, options);
    }
    // ── 工具：rp_* ─────────────────────────────────────────────────────────────
    const { sessionOf } = registerTaskTools({
        ctx,
        T,
        clusterJob,
        resolveRoleplaySession,
        storyBranchIsActive,
        characterCluster,
        cardWorkflowKey,
        isRoleplaySession,
        ensureBranch,
        tavernTasks,
        activeCardWorkflow,
        characterRoster,
        contextWindowKey,
        clusterLoreVisible,
        startExportJob: (...args) => startExportJob(...args),
    });
    registerAuthorTools({ ctx, T, simpleTool, sessionOf, storyBranchIsActive });
    registerNarrativePresetTool({
        ctx,
        simpleTool,
        sessionOf,
        storyBranchIsActive,
        presets: narrativePresets,
    });
    const workspaceSessionOf = async (exec) => {
        const session = await sessionOf(exec);
        assertWorkspaceSession(session);
        return session;
    };
    const adaptation = registerAdaptationTools({
        ctx,
        table: T.branch,
        sessionOf: workspaceSessionOf,
        retrieval,
        active: storyBranchIsActive,
        selectionStamp: session => {
            const catalog = ctx.get('tavernConversations');
            if (!catalog)
                return session.id;
            const root = catalog.rootOf(session.id);
            const book = catalog.snapshot().conversations[root];
            return !book || book.activeSessionId === session.id
                ? `${root}:${book?.selectionRevision ?? 0}:${session.id}`
                : null;
        },
        askReadingMode: async (exec, target) => {
            if (!exec.agent)
                throw Error('当前上下文无法询问阅读方式');
            const result = await ctx.userQuestions.ask({
                agent: exec.agent,
                signal: exec.signal,
                questions: [{
                        id: 'reading-mode',
                        header: '阅读方式',
                        question: '这本小说使用哪种改编模式？',
                        options: [
                            { label: '精读', description: '完整阅读全书、逐段笔记并检索查证；精度优先，耗时和用量较高。' },
                            { label: '粗颗粒度', description: '建立全书索引后研究世界观与主角专题，按需回读；适合超长小说，不保证细节无遗漏。' },
                        ],
                    }],
            });
            const choice = result.answers.find(answer => answer.id === 'reading-mode');
            if (choice?.custom
                || choice?.selected.length !== 1
                || !['精读', '粗颗粒度'].includes(choice.selected[0])) {
                throw Error('未选择有效阅读方式；尚未开始正式研究');
            }
            const mode = choice.selected[0] === '精读' ? 'close-reading' : 'coarse';
            let protagonist = target.protagonist;
            // The tool's admission guard reports configuration and ends this turn.
            // Do not ask more adaptation questions before that prerequisite exists.
            if (mode === 'coarse') {
                const models = await retrieval.adaptationModels(await workspaceSessionOf(exec));
                if (!models.providers.some(provider => provider.id === models.activeProviderId && provider.ready)) {
                    return { mode, protagonist, openingPoint: target.openingPoint };
                }
            }
            if (mode === 'coarse' && !protagonist.trim()) {
                const focus = await ctx.userQuestions.ask({
                    agent: exec.agent,
                    signal: exec.signal,
                    questions: [{
                            id: 'reading-target',
                            header: '改编主角',
                            question: '粗颗粒度研究重点改编哪位人物？',
                        }],
                });
                const answer = focus.answers.find(item => item.id === 'reading-target');
                protagonist = answer?.custom ?? answer?.selected.join('、') ?? '';
            }
            return { mode, protagonist, openingPoint: target.openingPoint };
        },
        scopeOf: async (session) => {
            await ctx.get('tavernConversations')?.ready;
            return ctx.get('tavernConversations')?.rootOf(session.id) ?? session.id;
        },
    });
    // Research gates only apply after a successful explicit adaptation start. Existing-card
    // import is a separate workflow and must never inherit novel-research requirements.
    const beforeAdaptationWrite = async (exec) => {
        const session = await sessionOf(exec);
        if (adaptationIsActive(eventsOf(session)))
            await adaptation.beforeWrite(exec);
    };
    // ── 可审计的来源跨度式读卡导入 ────────────────────────────────────────────
    // 模型只负责判断“哪几行属于哪个栏目”；真正写入的正文由后端从已归档的
    // normalizedSource 截取。这样模型无法在工具参数里把 20K 原卡改写成 3K 摘要。
    const { importRecordKey, spanText, withImportLock, awaitImportBarrier, importSummary, assertImportRecordIntegrity, } = registerRoleplayImports({
        beforeWrite: beforeAdaptationWrite,
        ctx,
        T,
        CARD_CLASSIFICATION_GUIDE,
        activeCardWorkflow,
        assertCardWorkflow,
        beginCardWorkflow,
        resumeCardWorkflows,
        cardWorkflowKey,
        libraryFor,
        resourceName,
        completeCardWorkflow,
        ensureBranch,
        RULE_TEXT_FIELDS,
        ensureState,
        simpleTool,
        sessionOf: workspaceSessionOf,
        RULE_IMPORT_FIELDS,
        archiveImported
    });
    registerCardAuthoring({
        ctx,
        T,
        svc,
        RULE_TEXT_FIELDS,
        sessionOf,
        beforeWrite: beforeAdaptationWrite,
    });
    registerSessionTools({ ctx, T, simpleTool, sessionOf });
    registerDraftCheck({
        ctx,
        sessionOf: workspaceSessionOf,
        beforeWrite: beforeAdaptationWrite,
    });
    registerRoleplayDiagnosis({
        ctx,
        T,
        simpleTool,
        sessionOf,
        modelPolicy,
        tavernTasks,
        telemetry,
        preparationRecordKey,
        characterCluster,
        characterRoster,
        memorySettingsPolicy,
        enhancements: async (session) => {
            const info = {};
            try {
                info.retrieval = await retrieval.diagnose(session);
            }
            catch {
                info.retrieval = {
                    available: false,
                    reason: 'RETRIEVAL_STATE_UNAVAILABLE',
                };
            }
            try {
                const preset = narrativePresets.policy(session.id);
                info.presets = {
                    revision: preset.revision,
                    conversationId: preset.conversationId,
                    scope: preset.local ? 'conversation' : 'global',
                    effective: preset.effective,
                    name: preset.preset.name,
                    readonly: preset.preset.readonly,
                    summary: preset.summary,
                    total: preset.presets.length,
                    tool: 'rp_preset',
                };
            }
            catch {
                info.presets = {
                    available: false,
                    reason: 'PRESET_STATE_UNAVAILABLE',
                };
            }
            try {
                const owner = ctx.get('tavernConversations')?.rootOf(session.id) ?? session.id;
                info.research = {
                    conversationId: owner,
                    sources: adaptation.list(owner).map(source => ({
                        sourceId: source.sourceId,
                        name: source.name,
                        segments: source.segments,
                        read: source.read,
                        reviewed: source.reviewed,
                        status: source.status,
                        indexPolicy: source.indexPolicy,
                    })),
                    indexProgressIncluded: false,
                };
            }
            catch {
                info.research = {
                    available: false,
                    reason: 'RESEARCH_STATE_UNAVAILABLE',
                };
            }
            return info;
        },
    });
    // rp_status_set is retired: automatic source-fenced maintenance owns panels.
    // Existing input records remain readable for restored sessions; no model tool
    // may create another input or schedule duplicate panel work.
    // ── 命令：/scene /worldbook /roll /regenerate /export-novel /branch /memory ──
    registerSessionCommands({
        ctx,
        T,
        isRoleplaySession,
        startExportJob: (...args) => startExportJob(...args),
        svc,
    });
    // ── 侧边栏 REST：读/写角色扮演状态（记忆/世界书/角色卡/设置）──────────────
    // 供 dsh-roleplay-ui 的侧边栏面板使用；路由随 standing 挂载注册一次，
    // 按 sessionId 解析会话并校验其预设；与 /api/session.export 同级的
    // 认证模型（浏览器 cookie）。
    const { collectBranchRecords, recordVersionsFor, readRoleplayState } = createRoleplayState({
        ctx,
        T,
        awaitImportBarrier,
        ensureBranch,
        carryTruncationBoundary,
        buildForkLookupIndex,
        reconcileCanonicalPlayerVariants,
        statusRecoveredSessions,
        recoverStatusObligations,
        nativeBranchGroupsFor,
        nativePlayerGroupsFor,
        assistantMessageId,
        userForkContext,
        locatePlayerRecoveryTarget,
        failedForkMembership,
        isRecoverySourceMember,
        backfillRecoverySourceMember,
        importRecordKey,
        preparationRecordKey,
        tavernTasks,
        memoryForContext,
        cloneContextWindow,
        contextWindowFor,
        selectedStatusRecord,
        selectedStatusGeneration,
        importSummary,
        deletedBranchMessageIdsFor,
        inheritedAssistantMessageIdsFor,
        normalizeDecisionRecord,
        userValues,
        svc,
        resolveRoleplaySession,
    });
    const maintenanceJobs = new Map();
    ctx.effect(() => ctx.connection.fetch.register({ requestBody: 'buffered',
        path: '/api/roleplay/card-adaptation',
        methods: ['GET', 'POST'],
        fetch: async (request) => {
            try {
                const url = new URL(request.url);
                const body = request.method === 'POST'
                    ? await request.json()
                    : null;
                const session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session) {
                    return new Response(JSON.stringify({ ok: false, error: '角色扮演对话不存在' }), { status: 404, headers: { 'content-type': 'application/json' } });
                }
                assertWorkspaceSession(session);
                const result = body
                    ? await adaptation.mutate(session, body)
                    : await adaptation.view(session, url.searchParams.get('sourceId') ?? undefined, Number(url.searchParams.get('cursor') ?? 0), url.searchParams.get('query') ?? '', url.searchParams.get('noteMode') ?? 'close-reading');
                if (body?.action === 'research-mode'
                    && body.readingMode === 'coarse'
                    && result
                    && typeof result === 'object'
                    && 'code' in result
                    && result.code === 'ADAPTATION_COARSE_MODEL_REQUIRED') {
                    taskAgents.get(session.id)?.cancel?.({
                        kind: 'hook',
                        reason: '粗颗粒度模式尚未配置可用的小说检索模型，本轮已停止；请先在长文本转角色卡中配置模型。',
                    }, { keepInbox: true });
                }
                return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
            }
            catch (error) {
                const message = String(error.message);
                return new Response(JSON.stringify({ ok: false, error: message }), {
                    status: message.includes('已更新') ? 409 : 400,
                    headers: { 'content-type': 'application/json' },
                });
            }
        },
    }), 'roleplay: novel adaptation management');
    registerTelemetryRoutes({
        ctx,
        resolveRoleplaySession,
        exchangeRates,
        priceCatalog,
        telemetry,
    });
    ctx.effect(() => ctx.connection.fetch.register({ requestBody: 'buffered',
        path: '/api/roleplay/retrieval-confirmations',
        methods: ['GET', 'POST'],
        fetch: async (request) => {
            try {
                const url = new URL(request.url);
                const body = request.method === 'POST'
                    ? await request.json()
                    : null;
                const session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session)
                    throw Error('角色扮演会话不存在');
                const result = body
                    ? await retrieval.resolveRebuild(session, String(body.id), String(body.action))
                    : { ok: true, pending: retrieval.pendingRebuilds(session) };
                return Response.json(result);
            }
            catch (error) {
                return Response.json({ ok: false, error: String(error.message) }, { status: 409 });
            }
        },
    }), 'roleplay: semantic index rebuild confirmation');
    ctx.effect(() => ctx.connection.fetch.register({ requestBody: 'buffered',
        path: '/api/roleplay/memory-retrieval',
        methods: ['GET', 'POST'],
        fetch: async (request) => {
            try {
                const url = new URL(request.url);
                const body = request.method === 'POST'
                    ? await request.json()
                    : null;
                const session = await resolveRoleplaySession(body?.sessionId ?? url.searchParams.get('sessionId'));
                if (!session) {
                    return new Response(JSON.stringify({ ok: false, error: '角色扮演会话不存在' }), { status: 404, headers: { 'content-type': 'application/json' } });
                }
                const result = body
                    ? await retrieval.mutate(session, body)
                    : url.searchParams.get('action') === 'search'
                        ? await retrieval.search(session, Object.fromEntries(url.searchParams))
                        : await retrieval.view(session);
                return new Response(JSON.stringify({ ok: true, ...result }), { headers: { 'content-type': 'application/json' } });
            }
            catch (error) {
                const message = String(error.message);
                return new Response(JSON.stringify({ ok: false, error: message }), {
                    status: message.includes('已更新') ? 409 : 400,
                    headers: { 'content-type': 'application/json' },
                });
            }
        },
    }), 'roleplay: retrieval management');
    const { startExportJob } = registerJobRoutes({
        ctx,
        T,
        resolveRoleplaySession,
        novelExports,
        modelPolicy,
        beginCardWorkflow,
        cardWorkflows,
        cardWorkflowKey,
        tavernTasks,
        taskAgents,
        libraryFor,
        migrateResources,
    });
    registerSettingsRoutes({
        ctx,
        T,
        resolveRoleplaySession,
        modelPolicy,
        ensureBranch,
        taskAgents,
        characterCluster,
        characterRoster,
        memorySettingFields,
        memorySettingsPolicy,
        svc,
        narrativePresets,
    });
    registerAvatarRoute({
        ctx,
        T,
        resolveRoleplaySession,
        ensureBranch,
        awaitImportBarrier,
        importRecordKey,
        assertImportRecordIntegrity,
    });
    registerMaintenanceRoute({
        ctx,
        resolveRoleplaySession,
        maintenanceJobs,
        latestStatusEvent,
        runStatusObligation,
        selectedStatusRecord,
    });
    // User info is account-local and must be available even before a roleplay
    // Agent is mounted, so /api/roleplay/userinfo is owned exclusively by the
    // profile-level dsh-roleplay-ui Host plugin. Do not redeclare that route in
    // this per-Agent preset.
    // 原生跨 Session 分支：prepare 只解析/冻结目标；register 在 Client
    // 创建 fork（首轮为 fresh roleplay Session）后、发送 prompt 前原子登记。
    registerBranchRoutes({
        ctx,
        T,
        resolveRoleplaySession,
        cloneBranchRecord,
        assertStoryBranchActive,
        withForkMutationLock,
        forkOperationKey,
        reconcileCanonicalPlayerVariants,
        buildForkLookupIndex,
        userForkContext,
        locatePlayerRecoveryTarget,
        assistantMessageId,
        forkPointerFor,
        hydrateForkGroup,
        forkGroupKey,
        groupMemberForSession,
        locateForkTarget,
        bootstrapChildBranch,
        registerRecoveryFork,
        registerNativeFork,
        forkAnchorLockKey,
        requestUserEvent,
        forkPendingKey,
        reconcileNativeFork,
        replaceAssistantText,
        replaceUserText,
    });
    registerPanelRoutes({
        ctx,
        T,
        resolveRoleplaySession,
        ensureBranch,
        withDecisionMutationLock,
        normalizeDecisionRecord,
        recordVersionsFor,
        readRoleplayState,
        svc,
        RULE_TEXT_FIELDS,
        withImportLock,
    });
    registerSettingTool({
        ctx,
        T,
        recordVersionsFor,
        svc,
        RULE_TEXT_FIELDS,
        withImportLock,
        sessionOf,
        storyBranchIsActive,
        tavernTasks,
        modelPolicy,
        resolveRoleplaySession,
        selectionStamp: session => {
            const catalog = ctx.get('tavernConversations');
            if (!catalog)
                return null;
            const root = catalog.rootOf(session.id);
            const book = catalog.snapshot().conversations[root];
            return !book || book.activeSessionId === session.id
                ? `${root}:${book?.selectionRevision ?? 0}:${session.id}`
                : null;
        },
        evidence: async (session, name, args) => adaptation.readForRepair(await workspaceSessionOf({ agent: { session } }), name, args),
    });
    ctx.logger?.info?.('roleplay-core: mounted');
}
