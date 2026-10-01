import type {
  CoreContext,
  CoreState,
  CoreSession,
  CoreAgent,
} from './roleplay-core-types.js'
import type { ContextSession } from './roleplay-context.js'
import { readProjectedStory,projectStoryEvent } from './roleplay-message-view.js'
import type { InheritanceOptions } from './roleplay-inheritance-types.js'
import type { MaintenanceRouteJob } from './roleplay-job-routes-types.js'
import type { NativeTaskInput, HostAgent } from './roleplay-task-host-types.js'
import type { TaskAgent } from './tavern-task-types.js'
import type { ImportRecord } from './roleplay-import-types.js'
import type {CompletionSnapshot} from './roleplay-completion-types.js'
import {
  keyOf,
  textOf,
  durableSeq,
  provenanceSeq,
  sha256,
  safeId,
  cloneRecord,
  recordSha256,
  readUserInfo,
  passthroughSchema,
  rollsSchema,
} from './roleplay-data.js'
import {
  eventsOf,
  sessionEventsIfReady,
  surfaceEvents,
  surfaceEntries,
  isCompletedTurnEnd,
  canonicalAssistantForTurn,
  recentWindowSince,
  roleplayWindowCutStartIndex,
  assertWorkspaceSession,
} from './roleplay-context.js'
import { decodeTaskSelection } from './tavern-task-primitives.js'
import { adaptationIsActive } from '../memory/memory-provenance.js'
export {
  createStableRoleplayFence,
  readRoleplayActivity,
  retireRoleplayContexts,
  recentWindowSince,
  retainRoleplayWindowContinuity,
  roleplayWindowCutStartIndex,
} from './roleplay-context.js'
// roleplay-core.js — DeepSeek Harness roleplay preset 编排核心。
//
// 正式产品把 preset 保留在 product/preset，运行时依赖来自 product/node_modules。
// 宿主服务仍通过 inject 取得；历史独立复制的 preset 目录不具有此依赖供给，
// 不能把产品内解析合同用于那类旧运维布局。
//
// 提供的服务（本 preset isolate group 内）：
//   roleplay — 供 roleplay-memory-engine / 未来 UI 半使用：
//     surfaceText(sessionId, seqs)   -> 指定 seq 的表面节点原文
//     lockedFacts(branchId)          -> 不可丢失事实（锁定卡片/世界书条目）
//     memoryHead(branchId)           -> 记忆账本头部
//     memoryUpdate(branchId, patch)  -> 记忆账本更新（版本 +1）
//     sceneCurrent(branchId)         -> 当前场景快照
//     branchLineage(session)         -> 分支血缘（父链 + seedLength）

import { resolve } from 'node:path'

import { registerRoleplayImports, importActiveKey, activeOpeningSource } from './roleplay-import.js'
import { provenImportPreludeAssistants } from './tavern-task-retirement.js'
import { internalTaskSeqs } from './tavern-tasks.js'

import { createNovelExports } from './novel-export.js'
import { createTelemetry } from './tavern-telemetry.js'
import { createMemoryRetrieval } from '../memory/memory-retrieval.js'
import { createPriceCatalog, createExchangeRates } from './tavern-pricing.js'
import { createRoleplayWorldlines } from './roleplay-worldlines.js'
import { createRoleplayStatus } from './roleplay-status.js'
import { createRoleplayPreparation, inputSnapshotReferenceCurrent } from './roleplay-preparation.js'
import { createRoleplayCompletion } from './roleplay-completion.js'
import { createRoleplayDecision, taskCancellation } from './roleplay-decision.js'
import { createRoleplayInheritance } from './roleplay-inheritance.js'
import { createResourceBridge } from './roleplay-resource-bridge.js'
import { createCardWorkflows } from './roleplay-card-workflow.js'
import {createCardAttachmentSources} from './roleplay-card-attachment.js'
import {createChatCardSources} from './roleplay-chat-card-source.js'
import {createChatCardNativeContext} from './roleplay-chat-card-context.js'
import {createRoleplayOpeningSelection,openingIntentKey} from './roleplay-opening-selection.js'
import type {OpeningIntent, OpeningRejectionCode,OpeningSelectionDeps} from './roleplay-opening-selection.js'
import {createRoleplayMvuOpening} from './roleplay-mvu-opening.js'
import {createRoleplayMvuState} from './roleplay-mvu-state.js'
import {createRoleplayMvuPlayer} from './roleplay-mvu-player.js'
import type {MvuStateObservation} from './roleplay-mvu-player-types.js'
import {registerMvuPlayerRoutes} from './roleplay-mvu-player-routes.js'
import type {Session as NativeSession} from '@deepseek-ai/dsh-session'
import {createRoleplayMvuDerived,readMvuPrefixCanonical} from './roleplay-mvu-derived.js'
import {createRoleplayMvuSchemaDerived} from './roleplay-mvu-schema-derived.js'
import {mvuSchemaDerivedPreparedKey,mvuSchemaDerivedBasisKey} from './roleplay-mvu-schema-derived-types.js'
import {createRoleplayMvuAncestry} from './roleplay-mvu-ancestry.js'
import {createRoleplayMvuEditFacts} from './roleplay-mvu-edit-facts.js'
import type {MvuEditBasisFacts} from './roleplay-mvu-edit-facts.js'
import {mvuInitializationEventKey,mvuInitializationHeadKey,verifyFrozenMvuInitializationFacts}
  from './roleplay-mvu-initialization.js'
import type {MvuInitializationEvent,MvuInitializationHead} from './roleplay-mvu-initialization.js'
import {createRoleplayMvuStoryCompletion} from './roleplay-mvu-story.js'
import type {MvuStoryCompletionDependencies} from './roleplay-mvu-story.js'
import {prepareInputManagementReceipt,verifyInputManagementReceipt} from './roleplay-input-management.js'
import {createRoleplayInputPreparation} from './roleplay-input-preparation.js'
import {createRoleplayImportInputTransition} from './roleplay-input-import.js'
import type {RoleplayInputBinding} from './roleplay-input-preparation.js'
import type {NativeInputAdmissionAgentV2} from '@deepseek-ai/dsh-agent-loop'
import type {InputCompletionScope} from './roleplay-input-completion.js'
import {registerOpeningRoutes} from './roleplay-opening-routes.js'
import { createRoleplayService } from './roleplay-service.js'
import {createSessionHistory, ensureSessionHistory} from './session-history.js'
import { createRoleplayTaskHost } from './roleplay-task-host.js'
import { registerRoleplayLoop } from './roleplay-loop.js'
import {
  retrieveWorldbook,
  taskDependenciesCurrent,
  buildDecisionContext,
  lockedFactsOf,
  authorUserValues,
  registerAuthorPrompts,
  residentAuthorContext,
} from './roleplay-author-context.js'
import { registerAuthorTools } from './roleplay-author-tools.js'
import { registerSessionTools, registerSessionCommands } from './roleplay-session-actions.js'
import { simpleTool, registerTaskTools } from './roleplay-task-tools.js'
import { createRoleplayState } from './roleplay-state.js'
import { registerRoleplayDiagnosis } from './roleplay-diagnosis.js'
import { registerCardAuthoring, registerDraftCheck } from './roleplay-authoring.js'
import { registerAdaptationTools } from './card-adaptation-tools.js'
import { registerSettingsRoutes } from './roleplay-settings-routes.js'
import { createNarrativePresets, registerNarrativePresetTool } from './narrative-presets.js'
import { registerTelemetryRoutes } from './roleplay-telemetry-routes.js'
import { registerJobRoutes, registerMaintenanceRoute } from './roleplay-job-routes.js'
import { registerBranchRoutes } from './roleplay-branch-routes.js'
import { registerAvatarRoute, registerPanelRoutes, registerSettingTool } from './roleplay-panel-routes.js'

export const name = 'roleplay-core'
const RULE_TEXT_FIELDS = ['core', 'plot', 'narrative', 'reply', 'style']
const RULE_IMPORT_FIELDS = {
  'core-setting': 'core',
  'plot-guidance': 'plot',
  'rule-narrative': 'narrative',
  'rule-reply': 'reply',
  'rule-style': 'style',
}
const CARD_CLASSIFICATION_GUIDE = `【按创作语义分拆，不按标题或文件字段机械归类】
人物完整人设→card；核心设定（core-setting）保存完整常驻世界背景、种族法则、核心威胁与长期矛盾；世界书（worldbook）是拿导演笔记与当前问题关键词去查的被动资料库，具体势力/地点/物品条目不长期驻留；剧情指引（plot-guidance）保存尚未发生的路线、触发条件与可能结局，不是剧情事实。
叙事与回复规则承载作者的创作方法：视角、镜头、细节密度、节奏、人物知情边界，以及单次回复如何展开。rule-narrative 指如何叙事和控制信息，例如镜头从环境前移到人物手部、动作与衣着变化符合现实、角色起初不知道某秘密且发现证据后才知道。rule-reply 指这一轮怎样写，例如长段流畅描写、充分展开外貌与对话、避免重复措辞或复述玩家输入、局部自然推进后停在需要玩家选择处。rule-style 保存文风特化和完整范文，不压成关键词；角色口头禅留在对应人设，文学示例用于模仿表达而非当作事件。
反例：人物知情限制不是低频世界书；假设路线不是已发生剧情；运行时的工具隔离、来源保真、记忆维护不是作者创作规则，系统自己保障，写新卡时不要要求作者编写工程指令。若导入原卡已有此类文字仍完整保留（归档或故事内约束），不能删除或升级成系统权限。
状态栏规则、HTML结构及其配套<style>/CSS整体归status；多个离散范围合并到同一status assignment.sourceSpans。beauty-css只放阅读正文的纯CSS，绝不能放状态栏HTML或整段HTML/CSS组件。人物共同关系背景可归核心设定，不要把关系小节虚构成第四个角色。
分类依据全文含义；混合模块拆开原文跨度，不能因为位于 description 或 system_prompt 字段便整段塞进人设或叙事规则。只提交原文跨度、完整保留作者措辞，不替作者补规则。`
// Self-maintained canonical source; audit/manual deployment only. Preflight
// must never restore roleplay core or UI from a compatibility snapshot.
const DSH_ROLEPLAY_CORE_PATCH = 'dsh-roleplay-status-obligation-v1'

export const inject = [
  'sessions',
  'agentLoop',
  'agents',
  'nexttavernMessageEdits',
  'nexttavernMvuPlayerMarkers',
  'sessionPersistence',
  'sessionQuery',
  'sessionController',
  'fileUploads',
  'attachments',
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
]

const DEFAULT_CONFIG = {
  workerProvider: null as string | null,
  workerModel: null as string | null,
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
}

const DOMAIN_NAME = 'roleplay'
const DOMAIN_VERSION = 1

// Native task transport. Same-model work yields to the existing Agentic Loop.
async function llmJson(
  ctx: CoreContext,
  route: { session: ContextSession; agent?: TaskAgent },
  options: Omit<NativeTaskInput, 'session' | 'agent' | 'format'>,
) {
  const result = await ctx.get('roleplay').nativeTask({ ...options, ...route, format: 'json' })
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
  if (result === null || isRecord(result)) return result
  throw new Error('任务没有返回 JSON 对象')
}

// ── 世界书检索（纯本地，确定性）──────────────────────────────────────────────

export { retrieveWorldbook, taskDependenciesCurrent, buildDecisionContext } from './roleplay-author-context.js'

// ── 工作提示词（worker 系统提示）────────────────────────────────────────────

const LEDGER_WORKER_SYSTEM =
  '你是角色扮演工作台的正史记录员。根据本轮用户输入与候选正文，抽取本轮新增的正史增量。' +
  '只输出 JSON：{"deltas":[{"type":"event|relation|promise|foreshadow|state|correction","summary":"一句话事实，含专名/数字/时间顺序","evidenceSeq":0,"status":"established|uncertain"}]}。' +
  '一次性描写不升级为永久规则；用户明确纠正的内容标 correction 并列为最高优先级；' +
  '不确定的标 uncertain。'

const CONTINUITY_WORKER_SYSTEM =
  '你是角色扮演工作台的连续性检查员。比对候选正文与既有正史（记忆+场景），只报告真实冲突。' +
  '只输出 JSON：{"verdict":"pass|conflict","conflicts":[{"claim":"正文中的表述","canon":"正史/既有设定","evidenceSeq":0,"severity":"high|medium|low"}]}。' +
  '用户明确表述的事实永远是正史；AI 的既有创作推断可以随着剧情发展被新信息修正。'

const ORGANIZE_WORKER_SYSTEM =
  '你是小说编辑。把给定的逐条对话记录整理成干净的连载小说稿件：按场景/章节分段、' +
  '删除一切元信息（seq 编号、角色名标签、工具痕迹）、保留全部正文原文不动、' +
  '为章节命名、场景切换处用空行+章节标题。只输出整理后的 Markdown 正文，不要任何说明。'

const STATUS_SYSTEM =
  '你是角色扮演工作台的状态栏渲染生成器。根据状态栏设定、当前场景与最新正文，生成状态栏 JSON：\n' +
  '{"title":"10字以内标题","html":"状态栏 HTML（可选）","fields":[{"emoji":"😊","label":"位置","value":"文本"}],' +
  '"options":[{"label":"选项文案（50字内）","heart":true}],"rawText":"纯文本状态栏（备用）"}\n' +
  '字段名必须写在 label，字段内容必须写在 value；options 仅供独立决策卡复用，下一步文案必须写在 options[].label，禁止把这些内容写进 reason/name/content 等其他键。' +
  '规则：状态栏只展示当前事实，遵守设定中的状态字段与格式（好感度数值规则、颜文字风格）。行动建议只在独立决策卡展示，不得写入 html、fields 或 rawText；即使旧卡要求状态栏展示 A/B/C 选项，也以此展示约定为准。' +
  '若设定含 HTML 模板，按作者布局输出完整 html；保留静态 class/id、内联样式及 style/script。作者动态占位符可用双花括号或 ⟦字段⟧，两者等价，必须填入本轮真实状态值（包括 style 中的进度数值），不要逐字回抄动态占位符。{{user}} / {{user_gender}} 是保留给渲染层的玩家身份变量。' +
  '作者把 HTML 与 CSS 分成独立代码块时，只输出填好状态值的 HTML，不输出 Markdown 围栏或说明；静态 CSS 由程序从作者模板恢复，无需复制生成。' +
  '旧模板内若有行动建议区、行动占位符或 class="f" 按钮，保留原有结构与属性但清空该区标题和内容，行动占位符填空字符串；程序会隐藏旧行动区。fields 只填状态，options 中保留一次结构化建议供独立决策卡复用，不在状态 HTML 重复生成。' +
  '任何涉及主角姓名的位置（title/label/value/html）一律输出 {{user}} 或 {{user_gender}} 占位符：不要写真实名字，也不要写 user/用户 等字面量，渲染层会统一确定性替换。' +
  '只依据正文与场景中实际发生的内容填写，不编造；若设定含正则美化规则，按其意图生成。只输出 JSON。'

const DECISION_SYSTEM =
  '你是角色扮演工作台的轮末建议生成器。根据最新正文与当前场景，为玩家生成 3 个下一步行动建议：' +
  '每条 50 字以内、第三人称叙事口吻、具体可执行、互不相同（一条偏主动推进，一条偏试探互动，一条可留白或转移场景）；' +
  '可加好感的选项 heart=true。选项文案必须放在 label，禁止放进 reason/name/content。只输出 JSON：{"options":[{"label":"…","heart":false}]}，不要输出任何其他文字。'

// ── 插件主体 ────────────────────────────────────────────────────────────────

export async function apply(ctx: CoreContext, config: Partial<typeof DEFAULT_CONFIG> = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...(config ?? {}) }
  let inputOwner: ReturnType<typeof createRoleplayInputPreparation<CoreSession>> | undefined
  const inputBindings = new Map<object,RoleplayInputBinding>()
  function attachInputOwner(agent:CoreAgent):RoleplayInputBinding | undefined {
    if (Number(agent.options?.subagentDepth) > 0 || !isRoleplaySession(agent.session)) return undefined
    const actual = ctx.get('agentLoop')?.getInputAdmissionAgent(agent)
    if (actual !== agent) return undefined
    if (!inputOwner) throw new Error('ROLEPLAY_INPUT_OWNER_NOT_READY')
    const binding = inputOwner.bind(agent as unknown as NativeInputAdmissionAgentV2 & {session:CoreSession})
    inputBindings.set(agent,binding)
    return binding
  }
  function inputSnapshotCurrent(session:ContextSession,snapshot:CompletionSnapshot):boolean {
    if (!snapshot.inputPreparation) return true
    const agent=taskAgents.get(session.id),binding=agent ? inputBindings.get(agent) : undefined
    const hot=binding?.persistedCurrency()
    const currency=hot?.preparationId===snapshot.inputPreparation.preparationId
      && binding?.checkSnapshot(hot).kind==='allow' ? hot
      : binding?.historicalCurrency(snapshot.inputPreparation)
    if (!currency?.snapshot) return false
    if (ctx.get('agentLoop')?.getInputAdmissionAgent(agent)!==agent) return false
    const {snapshot:_reference,...basis}=currency
    return recordSha256(basis)===recordSha256(snapshot.inputPreparation)
      && inputSnapshotReferenceCurrent(T.branch,session.id,currency)
  }
  const mvuAncestry=createRoleplayMvuAncestry({live:id=>ctx.sessions.get(id),
    observe:(id,options)=>ctx.sessionQuery.observeSession(id,options)})
  ctx.effect(()=>mvuAncestry.dispose,'roleplay: read-only numerical ancestry')
  const history = createSessionHistory({
    get: id => ctx.sessions.get(id),
    observe: (id, options) => ctx.sessionQuery.observeSession(id, options),
  })
  // Register the feed before any asynchronous observation. session/created is
  // fire-and-forget; agent/created is the awaited gate before the first step.
  ctx.on('session/event', history.accept, {global: true, prepend: true})
  ctx.on('session/disposed', history.disposeSession, {global: true})
  ctx.on('agent/created', async ({agent, signal}) => {
    await history.ready(agent.session, signal)
    if(agent.session.header?.isSeeded)await mvuAncestry.ready(agent.session,signal)
    attachInputOwner(agent)
    return undefined
  }, {global: true, prepend: true})
  ctx.effect(() => history.dispose, 'roleplay: session history')

  // `sessions` contains only Agents currently retained by the Host. Opening a
  // persisted conversation directly into Reader after a service restart does
  // not necessarily retain its Agent first, so REST callers must use the Host
  // Session API to resume exactly the Session they address. This is activation,
  // not generation: no prompt is sent and unselected sibling branches stay cold.
  async function resolveRoleplaySession(sessionId: unknown) {
    const id = String(sessionId ?? '').trim()
    if (!id) return null
    let session: CoreSession | null | undefined = ctx.sessions.get(id)
    if (!session) {
      try {
        const found = await ctx.sessionController.resolveAgent(id)
        session = found && !('error' in found)
          ? found.agent?.session ?? ctx.sessions.get(id)
          : null
      } catch (error) {
        try {
          ctx.logger?.warn?.(`roleplay: failed to resume Session ${id}: ${String(error instanceof Error ? error.message : error)}`)
        } catch {}
        return null
      }
    }
    if (session) {
      await ensureSessionHistory(session)
      if(session.header?.isSeeded)await mvuAncestry.ready(session)
    }
    return session && isRoleplaySession(session) ? session : null
  }

  // per-session 运行时状态（standing mount 被同一 preset 的多个会话共享）
  const sessions = new Map<string, CoreState>() // sessionId -> runtime state
  // Decision cards are produced by an asynchronous worker while the browser
  // may answer (or a new turn may supersede them).  Serialize every read/
  // modify/write for one branch so a late worker can never resurrect an
  // already answered card.
  const decisionMutationLocks = new Map<string, Promise<void>>()

  async function withDecisionMutationLock<R>(
    branchId: string,
    work: () => Promise<R>,
  ): Promise<R> {
    const key = String(branchId)
    const prior = decisionMutationLocks.get(key) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate
    })
    const queued = prior.catch(() => {}).then(() => gate)
    decisionMutationLocks.set(key, queued)
    await prior.catch(() => {})
    try {
      return await work()
    } finally {
      release()
      if (decisionMutationLocks.get(key) === queued) decisionMutationLocks.delete(key)
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
  })
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
  }

  const taskAgents = new Map<string, CoreAgent>()
  const priceCatalog = createPriceCatalog({ table: T.branch })
  const exchangeRates = createExchangeRates({ table: T.branch })
  const telemetry = createTelemetry({
    table: T.branch,
    sessions: ctx.sessions,
    query: ctx.sessionQuery,
    jobs: () => [...T.branch.entries()]
      .filter(([key]) =>
        key.startsWith('tavern_job__')
        || key.startsWith('tavern_cardjob__')
        || key.startsWith('tavern_novel__'),
      )
      .map(([, value]) => value),
  })
  // Observe every supported native LLM entry, including retries, regeneration,
  // auxiliary calls and child sessions. Never filter by current story surface.
  ctx.on('llm/stream', (options, next) => telemetry.observe(options, next), { global: true })
  ctx.on('session/event', (session, event) => {
    if (['turn/end', 'tool/result', 'compaction/end'].includes(event?.type)) {
      void telemetry.ingest(session).catch(() => {})
    }
  }, { global: true })
  ctx.effect(() => {
    const tick = () => {
      if (telemetry.prices().autoSync) priceCatalog.refresh()
    }
    tick()
    const timer = setInterval(tick, 6 * 60 * 60 * 1000)
    timer.unref?.()
    return () => clearInterval(timer)
  }, 'roleplay: automatic price catalog refresh')
  ctx.effect(() => {
    const tick = () => {
      if (exchangeRates.state().fetchedAt) exchangeRates.refresh()
    }
    tick()
    const timer = setInterval(tick, 60 * 60 * 1000)
    timer.unref?.()
    return () => clearInterval(timer)
  }, 'roleplay: daily exchange rate refresh')
  const { libraryFor, resourceName, archiveImported, migrateResources } = createResourceBridge({ T })
  const {
    sameModelRoute,
    canonicalModelRoute,
    executedMainRoute,
    modelPolicy,
    taskStory,
    characterCluster,
    characterRoster,
    clusterLoreVisible,
    clusterPhase,
    clusterJob,
    tavernTasks,
    nativeTask,
    resumeMemoryWork,
    resumeStatusMaintenance,
  } = createRoleplayTaskHost({
    inputCurrency:session => {
      const agent = taskAgents.get(session.id)
      const current = agent ? inputBindings.get(agent)?.current() : undefined
      if (!current || current.kind==='legacy') return undefined
      if (!current.currency) throw new Error('INPUT_TASK_PERMISSION_UNKNOWN')
      return current.currency
    },
    inputCurrencyCurrent:(session,currency) => {
      const agent = taskAgents.get(session.id)
      const binding=agent ? inputBindings.get(agent) : undefined
      return !!binding && binding.checkAttempt(currency).kind === 'allow' && (!currency.snapshot
        || recordSha256(currency.snapshot)===recordSha256(binding.persistedCurrency()?.snapshot)
        && inputSnapshotReferenceCurrent(T.branch,session.id,currency))
    },
    inputHistoricalCurrencyCurrent:(session,currency) => {
      const agent=taskAgents.get(session.id)
      const binding=agent ? inputBindings.get(agent) : undefined
      const original=binding?.historicalCurrency(currency)
      return !!agent && ctx.get('agentLoop')?.getInputAdmissionAgent(agent)===agent && !!original
        && binding?.checkHistoricalSnapshot(original).kind==='allow'
        && (!currency.snapshot || recordSha256(currency.snapshot)===recordSha256(original.snapshot))
        && inputSnapshotReferenceCurrent(T.branch,session.id,original)
    },
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
  })
  const novelExports = createNovelExports<ContextSession, HostAgent | undefined>({
    table: T.branch,
    history: session => {
      const engine = ctx.get('compaction')
      if (typeof engine?.storyEvidence !== 'function') {
        throw new Error('完整剧情历史服务尚未就绪，请稍后重试导出')
      }
      return engine.storyEvidence(session)
    },
    request: spec => nativeTask({
      ...spec,
      selection: decodeTaskSelection(spec.selection),
    }),
    archive: async (session, job, markdown) => {
      assertWorkspaceSession(session)
      const lib = libraryFor(session)
      const resource = await lib.archive({
        name: resourceName(job.plan!.title),
        type: 'text/markdown',
        bytes: Buffer.from(markdown, 'utf8'),
        source: {
          sessionId: session.id,
          kind: 'novel-export',
          jobId: job.id,
          sourceHash: job.sourceHash,
        },
      })
      return lib.metadata(resource.id)
    },
  })
  async function resumeNovelExports(session: ContextSession,agent: HostAgent | undefined,signal?: AbortSignal) {
    const resumableJobs = novelExports
      .list(session)
      .filter(job => ['queued', 'running', 'waiting-main'].includes(job.status))
    for (const job of resumableJobs) {
      await novelExports.drive(session, job.id, agent, signal)
    }
  }
  // The workflow host is registered before import tools; only the ready hook
  // invokes this driver, after the importer installs it below.
  let structuredImportDriver: ReturnType<typeof registerRoleplayImports>['driveStructuredImport'] | undefined
  const {
    cardWorkflowKey,
    cardWorkflows,
    activeCardWorkflow,
    assertCardWorkflow:assertCardWorkflowRecord,
    beginCardWorkflow,
    resumeCardWorkflows,
    completeCardWorkflow,
  } = createCardWorkflows({
    T,
    storyBranchIsActive: (...args) => storyBranchIsActive(...args),
    modelPolicy,
    statusFixedContext: (...args) => statusFixedContext(...args),
    nativeTask,
    driveStructuredImport: (...args) => {
      if (!structuredImportDriver) throw new Error('结构化导入执行器尚未注册')
      return structuredImportDriver(...args)
    },
    CARD_CLASSIFICATION_GUIDE,
    archiveImported,
    libraryFor,
    resourceName,
    tavernTasks,
    taskAgents,
    ctx
  })
  const chatAttachmentSources = createCardAttachmentSources({T,libraryFor,
    fileUploads:ctx.fileUploads,attachments:ctx.attachments})
  const chatNativeContext = createChatCardNativeContext({session:id => ctx.sessions.get(id),
      ownedAgent:agent => ctx.get('agentLoop')?.getInputAdmissionAgent(agent),
      deletedMessageIds:session => deletedBranchMessageIdsFor(session)})
  const chatCardSources = createChatCardSources({sources:chatAttachmentSources,...chatNativeContext})
  function assertCardWorkflow(session:Parameters<typeof assertCardWorkflowRecord>[0],
    record:Parameters<typeof assertCardWorkflowRecord>[1]) {
    assertCardWorkflowRecord(session,record)
    if (!record?.workflowId) return
    const job = cardWorkflows(session).find(value => value.id === record.workflowId)
    if (job?.clientRequestId) {
      const proof = chatAttachmentSources.readChatProof(session,job.clientRequestId)
      if (proof) {
        if (job.source.sha256 !== proof.file.attachmentId.slice(7)) throw new Error('聊天角色卡原件与导入任务哈希不一致')
        chatCardSources.assertCurrent(session,job.clientRequestId)
      }
    }
  }

  const {
    memorySettingsPolicy,
    contextWindowKey,
    cloneContextWindow,
    buildPhaseA,
    storyWindowSettings,
    memoryForContext,
    contextWindowFor,
    memorySettingFields,
  } = createRoleplayPreparation({
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
    selectedStatusRecord: (...args) => selectedStatusRecord(...args),
    readNumericalState:sessionId=>{
      if(mvuOpening.hasSchemaOpening(sessionId)) {
        const snapshot=mvuOpening.readSchemaSnapshot(sessionId)
        if(!snapshot)throw Error('MVU_SCHEMA_NUMERICAL_STATE_UNAVAILABLE')
        return snapshot
      }
      const result=mvuState.readNumericalAuthority(sessionId)
      if(result.kind!=='ready')throw new Error(`MVU_NUMERICAL_STATE_${result.code}`)
      return result.snapshot
    },
  })

  // storage-domain get() returns an immutable logical snapshot.  Always clone
  // before preparing a changed record so a failed put cannot leak mutations.
  const cloneBranchRecord = <V>(value: V) => value == null ? value : structuredClone(value)

  // The model and older roleplay records use several aliases for the same
  // status-bar fields. Normalize at the boundary so storage, workers, and UI
  // all see one stable shape without rewriting historical records in place.
  const {
    statusFixedContext,
    runStatusObligation,
    textAlias,
    normalizeDecisionRecord,
    normalizeStatusOption,
    selectedStatusRecord,
    statusSource,
    normalizeStatusRecord,
    queueStatusObligation,
    statusRunStartSeq,
    recoverStatusObligations:recoverStoredStatusObligations,
    statusRecoveredSessions,
    selectedStatusGeneration,
    latestStatusEvent,
  } = createRoleplayStatus({
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
  })
  const userValues = (branchId: string) => authorUserValues(T, branchId, textAlias)
  function recoverStatusObligations(...args:Parameters<typeof recoverStoredStatusObligations>) {
    // An edited/unready numerical branch has no current story authority.
    // State reads must not start model work over its superseded prose.
    if(editBasisFacts(args[0].id).kind!=='none'
      &&mvuOpening.readInputObservation(args[0].id).kind==='management')return
    return recoverStoredStatusObligations(...args)
  }

  // domain 生命周期归本 fiber：卸载/失败挂载时必须 close，否则域名泄漏、
  // 重挂载会撞上 "already open"。
  ctx.effect(() => () => domain.close(), 'roleplay: close domain')

  const ensureState = (sessionId: string): CoreState => {
    let st = sessions.get(sessionId)
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
      }
      sessions.set(sessionId, st)
    }
    return st
  }

  const resolveRoute = (session: ContextSession, agent?: TaskAgent) => ({ session, agent: agent ?? taskAgents.get(session.id) })

  const isRoleplaySession = (session: ContextSession | null | undefined) => {
    if (!session) return false
    const events = sessionEventsIfReady(session)
    if (events === null) return session.header?.agentPreset === 'roleplay'
    if(events.some(e=>e?.type==='subagent/descriptor'&&Number(e.seq)>=Number(session.inheritedEventCount??0)))return false
    let preset = session.header?.agentPreset
    for (const e of events) {
      if (e && e.type === 'agent-preset/selected' && e.data?.agentPreset) preset = e.data.agentPreset
    }
    return preset === 'roleplay'
  }

  // ── 原生 Session 分支索引 ────────────────────────────────────────────────
  // 每个候选回复都是一个独立 Session；分支分页只保存很小的导航元数据，
  // 不复制兄弟分支正文。Harness 因而仍按当前 Session 尾页懒加载，模型、
  // 世界书检索和记忆也天然只看到当前选择的正史。

  const {
    storyBranchIsActive,
    assertStoryBranchActive,
    reconcileCanonicalPlayerVariants,
    buildForkLookupIndex,
    reconcileNativeFork,
    failPendingNativeFork,
    nativeBranchGroupsFor,
    nativePlayerGroupsFor,
    assistantMessageId,
    userForkContext,
    locatePlayerRecoveryTarget,
    failedForkMembership,
    isRecoverySourceMember,
    backfillRecoverySourceMember,
    deletedBranchMessageIdsFor,
    inheritedAssistantMessageIdsFor,
    withForkMutationLock,
    forkOperationKey,
    forkPointerFor,
    hydrateForkGroup,
    forkGroupKey,
    groupMemberForSession,
    locateForkTarget,
    locateProgrammaticOpeningTarget,
    bootstrapChildBranch,
    registerRecoveryFork,
    registerNativeFork,
    forkAnchorLockKey,
    requestUserEvent,
    forkPendingKey,
    replaceAssistantText,
    replaceUserText
  } = createRoleplayWorldlines({
    messageEdits: ctx.nexttavernMessageEdits,
    beginNumericalEdit:id=>{mvuEdits.begin(id);mvuOpening.invalidateSchemaSession(id)},
    persistNumericalEdit:async(id,editSeq)=>{
      const result=await mvuEdits.persistEdit({sessionId:id,editSeq})
      if(result.kind==='unknown')throw Error(result.code)
    },
    confirmUnchangedNumericalEdit:id=>mvuEdits.confirmNoEdit(id),
    flushEdits: async session => {
      if (!await ctx.sessions.flush(session)) throw new Error('会话编辑尚无持久化提供者，未提交派生状态')
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
    commitDerivedBasis:async(operation,child)=>{
      if(schemaDerived?.required(child.id)) {
        const actual=ctx.sessions.get(child.id)
        if(!actual)throw Error('SCHEMA_DERIVED_SESSION_UNAVAILABLE')
        await schemaDerived.commit(operation,actual as unknown as NativeSession)
      }else await mvuDerived.commit(operation,child)
    },
    durableSeq,
    canonicalAssistantForTurn,
    surfaceEntries,
    withDecisionMutationLock,
    normalizeDecisionRecord,
    cloneRecord,
    readOpeningIntent:source => openingSelection.readIntent(source),
    provenanceSeq
  })

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
  })
  const retrieval = createMemoryRetrieval({
    table: T.branch,
    record: call => telemetry.recordEmbedding(call),
    session: id => ctx.sessions.get(id),
    scopeOf: session => ctx.get('tavernConversations')?.rootOf(session.id) ?? session.id,
    list: async () => await ctx.sessionQuery?.listSessions?.() ?? [],
    read: async id => {
      const view = await readProjectedStory(ctx, id)
      return { session: view.header, events: view.events, view }
    },
    // Both live and cold inputs are native session logs; preserve their surface for tombstone checks.
    active: session => storyBranchIsActive(session as Parameters<typeof storyBranchIsActive>[0]),
  })
  Object.assign(svc,{retrieval})
  ctx.effect(() => () => retrieval.dispose(), 'roleplay: retrieval lifetime')
  ctx.on('session/created', session => retrieval.created(session), { global: true })
  ctx.on('session/event', async (session, event) => {
    if (['turn/end', 'user/message', 'compaction/end', 'roleplay/message-edit'].includes(event.type)) {
      await retrieval.changed(session)
    }
  }, { global: true })
  ctx.provide('roleplay', svc)

  // ── systemPrompt：{{user}}/{{user_gender}} 变量 + 角色卡 section ─────────────
  // 优先级：用户信息（设置页填写）> 玩家角色卡名 > 默认「用户」。

  const narrativePresets = createNarrativePresets(
    T.branch,
    id => ctx.get('tavernConversations')?.rootOf(id) ?? id,
  )
  registerAuthorPrompts({
    ctx,
    T,
    isRoleplaySession,
    userValues,
    characterCluster,
    characterRoster,
    CARD_CLASSIFICATION_GUIDE,
    narrativePresets,
  })

  // ── 阶段 A：程序组装当前分支笔记与窗口；主代理按需查资料 ──────────────────

  const { preparationRecordKey, taskInstruction } = registerRoleplayLoop({
    inputBinding:agent => inputBindings.get(agent),
    inputSnapshotCurrent,
    authorContext: session => residentAuthorContext(T, session.id),
    adaptationScope: session => ctx.get('tavernConversations')?.rootOf(session.id) ?? session.id,
    importPromptCheckpoint: session => {
      const checkpoint = activeOpeningSource(T.branch, session.id)
      if (!checkpoint) return null
      const record = T.branch.get(importRecordKey(checkpoint.sourceRecordSessionId,checkpoint.importId)) as ImportRecord
      const job = record.workflowId ? cardWorkflows(session).find(value => value.id === record.workflowId) : undefined
      let openingChoicePending = false
      if (job?.status === 'completed' && job.generation === record.workflowGeneration
        && job.source.sha256 === record.rawSha256 && job.clientRequestId) {
        assertWorkspaceSession(session)
        openingChoicePending = !!chatAttachmentSources.readChatProof(session,job.clientRequestId)
      }
      return {
        importId: checkpoint.importId,
        normalizedSha256: checkpoint.normalizedSha256,
        openingChoicePending,
        opening: String(
          T.opening.get(keyOf(session.id, 'scene'))?.text ?? '没有作者开场，等待玩家行动。',
        ),
      }
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
  })
  // ── 阶段 B/C：正文出现后并行抽取 + 单写者提交 ──────────────────────────────

  function isLatestVisibleTurn(session: ContextSession, turnId: number, assistantSeq: number) {
    // Raw logs retain shadowed sibling turns. “Latest” for a decision card is
    // the latest completed assistant on the selected surface, not the last
    // turn/start in that audit log.
    const entries = surfaceEntries(session)
    const current = entries.find((entry) => entry.kind === 'assistant'
      && Number(entry.seq) === Number(assistantSeq)
      && Number(entry.turn) === Number(turnId))
    if (!current) return false
    return !entries.some((entry) => entry.kind === 'assistant' && Number(entry.seq) > Number(current.seq))
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
  })

  const { runPhaseBC, isStale,awaitOwnedCompletion } = createRoleplayCompletion({
    inputSnapshotCurrent,
    isManagementInput:(session,turn)=>{
      const agent=taskAgents.get(session.id),current=agent&&inputBindings.get(agent)?.current()
      return current?.kind==='management'&&current.checkpoint?.actualTurn===turn
    },
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
  })

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
  })
  async function ensureBranch(session: ContextSession, options?: InheritanceOptions) {
    return initializeBranch(session, options)
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
  })

  registerAuthorTools({ ctx, T, simpleTool, sessionOf, storyBranchIsActive })
  registerNarrativePresetTool({
    ctx,
    simpleTool,
    sessionOf,
    storyBranchIsActive,
    presets: narrativePresets,
  })
  const workspaceSessionOf = async (exec: Parameters<typeof sessionOf>[0]) => {
    const session = await sessionOf(exec)
    assertWorkspaceSession(session)
    return session
  }
  const adaptation = registerAdaptationTools({
    ctx,
    table: T.branch,
    sessionOf: workspaceSessionOf,
    retrieval,
    active: storyBranchIsActive,
    selectionStamp: session => {
      const catalog = ctx.get('tavernConversations')
      if (!catalog) return session.id
      const root = catalog.rootOf(session.id)
      const book = catalog.snapshot().conversations[root]
      return !book || book.activeSessionId === session.id
        ? `${root}:${book?.selectionRevision ?? 0}:${session.id}`
        : null
    },
    askReadingMode: async (exec, target) => {
      if (!exec.agent) throw Error('当前上下文无法询问阅读方式')
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
      })
      const choice = result.answers.find(answer => answer.id === 'reading-mode')
      if (
        choice?.custom
        || choice?.selected.length !== 1
        || !['精读', '粗颗粒度'].includes(choice.selected[0]!)
      ) {
        throw Error('未选择有效阅读方式；尚未开始正式研究')
      }
      const mode = choice.selected[0] === '精读' ? 'close-reading' : 'coarse'
      let protagonist = target.protagonist
      // The tool's admission guard reports configuration and ends this turn.
      // Do not ask more adaptation questions before that prerequisite exists.
      if (mode === 'coarse') {
        const models = await retrieval.adaptationModels(await workspaceSessionOf(exec))
        if (!models.providers.some(
          provider => provider.id === models.activeProviderId && provider.ready,
        )) {
          return { mode, protagonist, openingPoint: target.openingPoint }
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
        })
        const answer = focus.answers.find(item => item.id === 'reading-target')
        protagonist = answer?.custom ?? answer?.selected.join('、') ?? ''
      }
      return { mode, protagonist, openingPoint: target.openingPoint }
    },
    scopeOf: async session => {
      await ctx.get('tavernConversations')?.ready
      return ctx.get('tavernConversations')?.rootOf(session.id) ?? session.id
    },
  })
  // Research gates only apply after a successful explicit adaptation start. Existing-card
  // import is a separate workflow and must never inherit novel-research requirements.
  const beforeAdaptationWrite = async (exec: Parameters<typeof sessionOf>[0]) => {
    const session = await sessionOf(exec)
    if (adaptationIsActive(eventsOf(session))) await adaptation.beforeWrite(exec)
  }

  // ── 可审计的来源跨度式读卡导入 ────────────────────────────────────────────
  // PNG/JSON 由程序按版本化投影生成字段证明；MD 仍由模型判断栏目。
  // 真正写入的正文始终从归档 normalizedSource 的跨度物化。

  const {
    importRecordKey,
    spanText,
    withImportLock,
    awaitImportBarrier,
    importSummary,
    assertImportRecordIntegrity,
    driveStructuredImport,
  } = registerRoleplayImports({
    inputTransition:createRoleplayImportInputTransition({
      owner:() => inputOwner,
      binding:agent => inputBindings.get(agent),
      nativeContext:(session,exec) => chatNativeContext.readNativeContext(session,exec),
      chatProof:(session,requestId) => {
        const proof=chatAttachmentSources.readChatProof(session,requestId)
        if (!proof) throw new Error('INPUT_CHAT_PROOF_MISSING')
        return proof
      },
      job:id => T.branch.get(cardWorkflowKey(id)) as import('./roleplay-card-workflow-types.js').CardWorkflowJob | undefined,
      pointer:id => T.branch.get(importActiveKey(id)),
      observe:session => mvuOpening.readInputObservation(session.id),
      row:(name,key) => {
        const tables:Record<string,{get(key:string):unknown}>={branch:T.branch,cards:T.cards,
          worldbook:T.worldbook,rules:T.rules,status:T.status,opening:T.opening}
        const table=tables[name]
        if (!table) throw new Error('INPUT_ACTIVATION_TABLE_INVALID')
        return table.get(key)
      },
      callOwnsInput:(session,callId) => {
        const events=eventsOf(session),call=events.findLast(event => event.type==='tool/call' && event.data?.callId===callId)
        const start=call ? events.findLast(event => event.type==='turn/start' && event.seq<call.seq
          && event.data?.turn===call.data?.turn) : undefined
        const link=start?.data?.['nativeInputLink'] as {preparation?:{namespace?:unknown}} | undefined
        return link?.preparation?.namespace==='nexttavern.roleplay.input.v2'
      },
    }),
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
    resolveChatCardSource:(session,exec,selector) => chatCardSources.resolve(session,exec,selector),
    RULE_IMPORT_FIELDS,
    archiveImported
  })
  structuredImportDriver = driveStructuredImport

  const openingTable = {get:(key:string) => T.branch.get(key),
    put:async (key:string,value:OpeningIntent) => {await T.branch.put(key,value)}}
  const openingContext = (sessionId:string) => {
    const user = userValues(sessionId)
    const prefix = `${sessionId}__`
    const cards = [...T.cards.entries()].filter(([key,card]) => key.startsWith(prefix)
      && card?.kind !== 'user').sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)
    return {user:user.name,user_gender:user.gender,char:String(cards[0]?.[1]?.name ?? '角色')}
  }
  const openingContextBinding = (id:string) => ({context:openingContext(id),bindingSha256:recordSha256({
    schemaVersion:1,encoding:'native-opening-context-binding-v1',sessionId:id,
    userInfo:recordSha256(readUserInfo()),userCard:recordSha256(T.cards.get(keyOf(id,'user'))),
    context:openingContext(id),
  })})
  let schemaDerived:ReturnType<typeof createRoleplayMvuSchemaDerived>|undefined
  const mvuDerived:ReturnType<typeof createRoleplayMvuDerived>=createRoleplayMvuDerived({tables:T,branch:T.branch,status:T.status,
    session:id=>ctx.sessions.get(id),readSession:mvuAncestry.readSession,
    projectPrefix:events=>ctx.nexttavernMessageEdits.projectPrefix(events),
    editProtocol:ctx.nexttavernMessageEdits,
    readSourceSha256:id=>mvuOpening.readSourceSha256(id),readOpeningContext:openingContextBinding,
    importActiveKey,importRecordKey,withSourceLock:(id,work)=>withImportLock(id,'mvu-derived',work),
    readGenesis:id=>mvuDerived.required(id)?mvuDerived.readGenesis(id):mvuOpening.readGenesis(id),state:()=>mvuState})
  const mvuOpening:ReturnType<typeof createRoleplayMvuOpening> = createRoleplayMvuOpening({tables:T,session:id => ctx.sessions.get(id),
    readNumericalAuthority:id=>mvuState.readNumericalAuthority(id),
    derivedBasisRequired:mvuDerived.required,
    schemaDerivedRequired:id=>T.branch.get(mvuSchemaDerivedPreparedKey(id))!==undefined
      ||T.branch.get(mvuSchemaDerivedBasisKey(id))!==undefined,
    readSchemaDerivedGenesis:(id,currentSource)=>schemaDerived?.readGenesis(id,currentSource),
    readSchemaEditInvalidation:id=>mvuEdits.readInvalidation(id),
    branchReady:id => ensureState(id).branchReady,importActiveKey,importRecordKey,
    withSourceLock:(id,work) => withImportLock(id,'mvu-initialization',work),
    recordVersionsFor:id => recordVersionsFor({id}),
    openingContext:openingContextBinding,
    messageEdits:ctx.nexttavernMessageEdits,deletedMessageIds:deletedBranchMessageIdsFor,
    catalog:id => openingSelection.readCatalog(id,openingContext(id)),
    readOpeningIntent:source => openingSelection.readIntent(source),
    legacyImportPending:id => {
      const session=ctx.sessions.get(id)
      return !!session && cardWorkflows(session).some(job => job.kind === 'card-import'
        && job.execution !== 'deterministic' && ['queued','running','waiting-main'].includes(job.status))
        || [...T.branch.entries()].some(([,record]) => record.sessionId===id && record.mode==='merge'
          && typeof record.importId==='string' && ['staging','committing','recovery-required'].includes(String(record.status)))
    },
    nativeLookup:async (identity,text) => {
      const found = await ctx.sessionController.resolveAgent(identity.sessionId)
      const agent = found?.agent
      const owned = ctx.get('agentLoop')?.getInputAdmissionAgent(agent)
      const sdk = owned as typeof owned & {lookupProgrammaticAssistantCommit?: (input:{operationId:string;messageId:string;text:string;
        source:{kind:'programmatic';schemaVersion:1;producer:string;origin:string;operationId:string}}) =>
        Promise<{status:'committed';turn:number} | {status:'absent' | 'unknown'}>}
      if (!agent || owned !== agent || typeof sdk?.lookupProgrammaticAssistantCommit !== 'function') return {status:'unknown'}
      return sdk.lookupProgrammaticAssistantCommit({operationId:identity.operationId,messageId:identity.messageId,
        text,source:{kind:'programmatic',schemaVersion:1,producer:'dsh-nexttavern',
          origin:`card-opening:${identity.source.importId}`,operationId:identity.operationId}})
    },
    schema:{
      agent:session=>{
        const agent=ctx.agents?.list().find(agent=>(agent.session as unknown)===session)
        const owned=agent&&ctx.get('agentLoop')?.getInputAdmissionAgent(agent)
        return owned===agent?owned as NativeInputAdmissionAgentV2|undefined:undefined
      },
      resolveAgent:async sid=>{
        const found=await ctx.sessionController.resolveAgent(sid),agent=found?.agent
        const owned=agent&&ctx.get('agentLoop')?.getInputAdmissionAgent(agent)
        return owned===agent?owned as NativeInputAdmissionAgentV2|undefined:undefined
      },
      active:session=>isRoleplaySession(session as unknown as CoreSession)&&ensureState(session.id).branchReady,
      markers:ctx.nexttavernMvuSchemaMarkers,flush:session=>ctx.sessions.flush(session as unknown as CoreSession),
      playerMarkers:ctx.nexttavernMvuPlayerMarkers,observe:id=>observeNumericalState(id),
      appendOpeningOnAgent:commitOpeningOnAgent},
  })
  function commitOpeningOnAgent(request:Parameters<OpeningSelectionDeps['appendOpening']>[0],input:unknown) {
    const agent=input as (CoreAgent & {commitProgrammaticAssistant?: (input: {
      operationId:string;messageId:string;text:string;source:{kind:'programmatic';schemaVersion:1;
        producer:string;origin:string;operationId:string}
    }) => Promise<{kind:'committed';turn:number;messageId:string}|{kind:'busy'}
      |{kind:'unknown';reason:string;code?:OpeningRejectionCode}>})|undefined
    if(!agent?.commitProgrammaticAssistant)throw Error('原生开场提交能力未就绪')
    return agent.commitProgrammaticAssistant({operationId:request.operationId,messageId:request.messageId,
      text:request.text,source:{kind:'programmatic',schemaVersion:1,producer:'dsh-nexttavern',
        origin:`card-opening:${request.source.importId}`,operationId:request.operationId}})
  }
  const openingSelectionDeps:OpeningSelectionDeps={
    ...mvuOpening.callbacks,
    table:openingTable,
    importActiveKey,
    importRecordKey,
    withLock:(key,action) => {
      const prefix = 'opening-choice:'
      if (!key.startsWith(prefix)) throw new Error('开场选择锁身份无效')
      return withImportLock(key.slice(prefix.length),'opening-choice',action)
    },
    appendOpening:async request => {
      const found=await ctx.sessionController.resolveAgent(request.sessionId)
      return commitOpeningOnAgent(request,found?.agent)
    },
    findOpeningByOperationId:async (intent:OpeningIntent) => {
      try {
        const found = await ctx.sessionController.resolveAgent(intent.sessionId)
        const agent = found?.agent as (CoreAgent & {lookupProgrammaticAssistantCommit?: (input: {
          operationId:string;messageId:string;text:string;source:{kind:'programmatic';schemaVersion:1;
            producer:string;origin:string;operationId:string}
        }) => Promise<{status:'committed';turn:number} | {status:'absent'}
          | {status:'unknown';code?:OpeningRejectionCode}>}) | undefined
        if (agent?.lookupProgrammaticAssistantCommit) {
          return await agent.lookupProgrammaticAssistantCommit({operationId:intent.operationId,messageId:intent.messageId,
            text:intent.renderedText,source:{kind:'programmatic',schemaVersion:1,producer:'dsh-nexttavern',
              origin:`card-opening:${intent.source.importId}`,operationId:intent.operationId}})
        }
        const session = ctx.sessions.get(intent.sessionId)
        if (!session) return {status:'unknown' as const}
        const history = eventsOf(session)
        if (history.some(event => event.type === 'turn/start' && event.data
          && Object.hasOwn(event.data,'programmatic'))) return {status:'unknown' as const}
        const matching = history.filter(event => event.type === 'assistant/message'
          && (event.data?.message?.source as {kind?:unknown;operationId?:unknown} | undefined)?.kind === 'programmatic'
          && (event.data?.message?.source as {operationId?:unknown} | undefined)?.operationId === intent.operationId)
        // Older writers cannot prove that an absent assistant was never attempted.
        // Exact old successes remain confirmable; retry requires the owned lookup contract.
        if (!matching.length) return {status:'unknown' as const}
        if (matching.length !== 1) return {status:'unknown' as const}
        const event = matching[0]!
        const message = event.data?.message
        const source = message?.source as {schemaVersion?:unknown;producer?:unknown;origin?:unknown} | undefined
        const block = message?.content?.[0] as {type?:unknown;text?:unknown} | undefined
        const turn = event.data?.turn
        if (message?.id !== intent.messageId || source?.schemaVersion !== 1
          || source.producer !== 'dsh-nexttavern' || source.origin !== `card-opening:${intent.source.importId}`
          || message?.content?.length !== 1 || block?.type !== 'text' || block.text !== intent.renderedText
          || !Number.isSafeInteger(turn) || !eventsOf(session).some(item => item.type === 'turn/end'
            && item.data?.turn === turn && item.data?.reason?.kind === 'completed')) {
          return {status:'unknown' as const}
        }
        if (!await ctx.sessions.flush(session)) return {status:'unknown' as const}
        return {status:'committed' as const,turn:Number(turn)}
      } catch { return {status:'unknown' as const} }
    },
  }
  const openingSelection:ReturnType<typeof createRoleplayOpeningSelection> = createRoleplayOpeningSelection({
    ...openingSelectionDeps,schemaOpening:mvuOpening.createSchemaSelection(openingSelectionDeps)})
  ctx.effect(()=>()=>{schemaDerived?.dispose();return mvuOpening.disposeSchema()},'roleplay: owned schema runtime lifetime')
  ctx.on('session/disposed',session=>mvuOpening.invalidateSchemaSession(session.id),{global:true})
  function editBasisFacts(id:string):MvuEditBasisFacts {
    try {
      if(mvuOpening.hasSchemaOpening(id)) {
        const basis=mvuOpening.readSchemaEditBasis(id)
        return basis?{kind:'verified',sourceSha256:mvuOpening.readSourceSha256(id),...basis}:{kind:'unknown'}
      }
      const basis=mvuState.readGenesisAuthority(id)
      if(basis.kind==='ready') {
        const genesis=mvuDerived.required(id)?mvuDerived.readGenesis(id):mvuOpening.readGenesis(id)
        const editFloorSeq=genesis&&'initEvent' in genesis?genesis.initEvent.native.turnEndSeq+1
          :ctx.sessions.get(id)?.inheritedEventCount
        if(!Number.isSafeInteger(editFloorSeq)||Number(editFloorSeq)<0)return {kind:'unknown'}
        return {kind:'verified',sourceSha256:basis.snapshot.sourceSha256,root:basis.snapshot.root,editFloorSeq:editFloorSeq!}
      }
      const hasNumericalFacts=[...T.status.entries()].some(([key])=>key.startsWith(`${id}__mvu-`))
        ||mvuDerived.required(id)
      if(!hasNumericalFacts)return {kind:'none'}
      if(mvuDerived.required(id)) {
        const frozen=mvuDerived.readDenialBasis(id)
        return frozen?{kind:'verified',sourceSha256:mvuOpening.readSourceSha256(id),...frozen}:{kind:'unknown'}
      }
      // An edited opening cannot grant current authority. Its immutable plan,
      // exact original event and committed intent can still identify a denial.
      const head=T.status.get(mvuInitializationHeadKey(id)) as unknown as MvuInitializationHead|undefined
      const event=head&&T.status.get(mvuInitializationEventKey(id,head.eventId)) as unknown as MvuInitializationEvent|undefined
      const intent=event&&T.branch.get(openingIntentKey(id,event.plan.identity.source.importId)) as OpeningIntent|undefined
      if(!head||!event||intent?.schemaVersion!==4||intent.status!=='completed'||intent.mode!=='native-json'
        ||!intent.initialization||recordSha256(intent.initialization)!==recordSha256(event.plan)
        ||recordSha256(intent.nativeReceipt)!==recordSha256(event.native)||head.sessionId!==id
        ||event.plan.identity.sessionId!==id||!verifyFrozenMvuInitializationFacts(event,head))return {kind:'unknown'}
      const session=ctx.sessions.get(id),history=session&&eventsOf(session),native=event.native
      if(!session||!history||history.some((entry,index)=>entry.seq!==index)
        ||native.turnStartSeq<Number(session.inheritedEventCount??0)
        ||history[native.turnStartSeq]?.type!=='turn/start'||history[native.turnEndSeq]?.type!=='turn/end'
        ||recordSha256(history[native.assistantSeq])!==native.messageVersion.eventSha256)return {kind:'unknown'}
      return {kind:'verified',sourceSha256:mvuOpening.readSourceSha256(id),editFloorSeq:event.native.turnEndSeq+1,
        root:{initEventId:event.eventId,
        initEventSha256:event.eventSha256,initHeadSha256:recordSha256(head),planSha256:event.plan.planSha256}}
    } catch {return {kind:'unknown'}}
  }
  const mvuEdits=createRoleplayMvuEditFacts({table:T.branch,readSession:id=>ctx.sessions.get(id),eventsOf,
    currentEdits:(session,events)=>ctx.nexttavernMessageEdits.current(session,events),readNumericalBasisFacts:editBasisFacts,
    readPendingVariantFacts:id=>{
      try {
        const session=ctx.sessions.get(id)
        if(!session)return 'unknown'
        const history=eventsOf(session)
        // A compacted player node still fed the branch's numerical history.
        // Its durable variant must not become invisible to this denial gate.
        for(const assistant of history.filter(event=>event.type==='assistant/message')) {
          const messageId=assistantMessageId(assistant),pointer=forkPointerFor(session,messageId)
          const group=pointer?.groupId?hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))):null
          const member=groupMemberForSession(group,session,messageId)
          if(!group||group.anchor.openingOnly||!member||member.pending||member.deleted)continue
          const variant=group.playerVariants[member.playerVariantId]
          if(!variant||typeof variant.text!=='string')return 'unknown'
          const user=history.find(event=>event.type==='user/message'&&event.data?.source?.kind==='user'
            &&event.seq===member.userSeq&&event.data.id===member.userMessageId)
          if(!user)return 'unknown'
          if(textOf(projectStoryEvent(session,user).data?.content)!==variant.text)return true
        }
        for(const user of surfaceEvents(session).filter(event=>event.type==='user/message'&&event.data?.source?.kind==='user')) {
          const {group,followingAssistant}=userForkContext(session,user.seq)
          const member=groupMemberForSession(group,session,assistantMessageId(followingAssistant))
          if(!group||group.anchor.openingOnly||!member||member.deleted)continue
          const variant=group.playerVariants[member.playerVariantId]
          if(!variant||typeof variant.text!=='string')return 'unknown'
          if(textOf(user.data?.content)!==variant.text)return true
        }
        return false
      } catch {return 'unknown'}
    },withSourceLock:(id,work)=>withImportLock(id,'mvu-edit-invalidation',work)})
  const mvuState:ReturnType<typeof createRoleplayMvuState>=createRoleplayMvuState({table:T.status,
    readGenesis:id=>mvuDerived.required(id)?mvuDerived.readGenesis(id):mvuOpening.readGenesis(id),
    withSourceLock:(id,work)=>withImportLock(id,'mvu-state',work),
    readEditInvalidation:mvuEdits.readInvalidation,
    manualGate:(id,intent)=>mvuPlayer.manualGate(id,intent),
    verifyStoredManualIntent:intent=>mvuPlayer.verifyStoredManualIntent(intent),
    checkManualPermission:(token,intent,phase)=>mvuPlayer.checkManualPermission(token,intent,phase),
    verifyStoredIntent:intent=>inputOwner?.verifyTerminalIntent(intent)===true,
    checkPermission:(token,intent)=>inputOwner?.checkTerminalPermission(token,intent)===true})
  const mvuPlayer=createRoleplayMvuPlayer({branch:T.branch,status:T.status,state:()=>mvuState,
    session:id=>ctx.sessions.get(id) as NativeSession|undefined,
    agent:session=>{
      const agent=ctx.agents?.list().find(agent=>(agent.session as unknown)===session)
      const owned=agent&&ctx.get('agentLoop')?.getInputAdmissionAgent(agent)
      return owned===agent?owned as NativeInputAdmissionAgentV2|undefined:undefined
    },
    active:session=>isRoleplaySession(session as unknown as CoreSession)&&ensureState(session.id).branchReady,
    sourceSha256:mvuOpening.readSourceSha256,withSourceLock:(id,work)=>withImportLock(id,'mvu-player',work),
    writeBlockCode:id=>mvuOpening.hasSchemaOpening(id)?'SCHEMA_MANUAL_NOT_ENABLED':undefined,
    flush:session=>ctx.sessions.flush(session as unknown as CoreSession),markers:ctx.nexttavernMvuPlayerMarkers})
  async function observeNumericalState(id:string):Promise<MvuStateObservation> {
    if(!mvuOpening.hasSchemaOpening(id))return mvuPlayer.observe(id)
    const session=ctx.sessions.get(id),observedNativeSeq=session?eventsOf(session).at(-1)?.seq??-1:-1
    const basis={schemaVersion:1 as const,sessionId:id,observedNativeSeq}
    try {await mvuOpening.preflightSchema(id)}catch(error) {
      const code=error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)?error.message:'SCHEMA_STORY_UNPROVEN'
      return {...basis,kind:'blocked',code,canEdit:false}
    }
    const snapshot=mvuOpening.readSchemaSnapshot(id)
    if(!snapshot)return {...basis,kind:'blocked',code:'SCHEMA_STORY_UNPROVEN',canEdit:false}
    const currentSession=ctx.sessions.get(id)
    const currentNativeSeq=currentSession?eventsOf(currentSession).at(-1)?.seq??-1:-1
    const editBlockCode=mvuOpening.schemaPlayerEditBlockCode(id)
    return {...basis,observedNativeSeq:currentNativeSeq,kind:'schema-ready',values:structuredClone(snapshot.values),
      valuesSha256:snapshot.valuesSha256,sourceSha256:snapshot.sourceSha256,eventId:snapshot.currentHead.eventId,
      snapshot,canEdit:!editBlockCode,...(editBlockCode?{editBlockCode}:{})}
  }
  const completionDeps:MvuStoryCompletionDependencies={table:T.branch,state:mvuState,awaitOwnedCompletion,
    sourceCurrent:(sid,sourceSha256)=>mvuOpening.readSourceSha256(sid)===sourceSha256,
    readCanonical:(sid,turn)=>{
      const session=ctx.sessions.get(sid),body=session&&canonicalAssistantForTurn(session,turn)
      const message=body?.data?.message
      return body&&message&&typeof message.id==='string'?{seq:body.seq,messageId:message.id,
        versionSha256:recordSha256(message),narrative:textOf(message.content)}:undefined
    },
    readHistoricalCanonical:(sid,seq,turn)=>{
      const session=ctx.sessions.get(sid),original=session&&eventsOf(session).find(event=>event.seq===seq)
      if(!session||original?.type!=='assistant/message'||original.data?.turn!==turn)return
      const selected=projectStoryEvent(session,original),message=selected.data?.message
      return message&&typeof message.id==='string'?{seq:original.seq,messageId:message.id,
        versionSha256:recordSha256(message),narrative:textOf(message.content)}:undefined
    },
    readConsumedCanonical:(sid,seq,turn,throughSeq)=>{
      const session=ctx.sessions.get(sid)
      if(!session||!Number.isSafeInteger(throughSeq)||throughSeq<seq)return
      const events=eventsOf(session)
      if(throughSeq>=events.length)return
      const body=readMvuPrefixCanonical(events.slice(0,throughSeq+1),turn,
        prefix=>ctx.nexttavernMessageEdits.projectPrefix(prefix))
      return body?.seq===seq?body:undefined
    },
    verifyNative:(scope:InputCompletionScope)=>{
      const receipt=scope.receipt,checkpoint=receipt.checkpoint,sid=checkpoint.sessionId
      const session=ctx.sessions.get(sid),agent=(ctx.agents?.list()??[]).find(agent=>agent.session.id===sid)
      const owned=agent&&ctx.get('agentLoop')?.getInputAdmissionAgent(agent)
      if(!session||owned!==agent||!owned||receipt.flushed!==true||receipt.schemaVersion!==1)return false
      const capability=owned as NativeInputAdmissionAgentV2
      if(typeof capability.lookupInputOwnership!=='function')return false
      const history=eventsOf(session),end=history.find(event=>event.seq===receipt.turnEndSeq)
      const start=history.find(event=>event.seq===checkpoint.startSeq)
      const marker=start?.data?.['nativeInputLink'] as {mode?:unknown;preparation?:unknown;refs?:unknown;workSha256?:unknown}|undefined
      if(!end||end.type!=='turn/end'||end.data?.turn!==checkpoint.actualTurn||end.data.reason?.kind!=='completed'
        ||recordSha256(end)!==receipt.turnEndSha256||history.filter(event=>event.type==='turn/end'
          &&event.data?.turn===checkpoint.actualTurn).length!==1||start?.type!=='turn/start'
        ||start.data?.turn!==checkpoint.actualTurn||marker?.mode!=='claim'
        ||recordSha256(marker.preparation)!==recordSha256(checkpoint.preparation)
        ||recordSha256(marker.refs)!==recordSha256(checkpoint.refs)||marker.workSha256!==checkpoint.workSha256
        ||receipt.admittedUsers.length!==checkpoint.refs.length)return false
      return checkpoint.refs.every((ref,index)=>{
        const actual=capability.lookupInputOwnership(ref),admitted=receipt.admittedUsers[index]
        return !!admitted&&recordSha256(admitted.ref)===recordSha256(ref)&&actual.status==='admitted'
          &&actual.turn===checkpoint.actualTurn&&actual.userSeq===admitted.userSeq
          &&actual.userSeq>checkpoint.firstStepStartSeq&&actual.userSeq<receipt.turnEndSeq
      })
    },
    prepareManagement:prepareInputManagementReceipt,
    verifyManagement:(scope,descriptor)=>verifyInputManagementReceipt({
      job:id=>T.branch.get(cardWorkflowKey(id)) as import('./roleplay-card-workflow-types.js').CardWorkflowJob|undefined,
      imported:(sid,id)=>T.branch.get(importRecordKey(sid,id)) as ImportRecord|undefined,
      pointer:sid=>T.branch.get(importActiveKey(sid)) as import('./roleplay-import-types.js').ImportPointer|undefined,
      row:(name,key)=>{
        const tables:Record<string,{get(key:string):unknown}>={cards:T.cards,worldbook:T.worldbook,
          rules:T.rules,status:T.status,opening:T.opening}
        if(!tables[name])throw new Error('INPUT_ACTIVATION_TABLE_INVALID')
        return tables[name].get(key)
      },
      sourceSha256:mvuOpening.readSourceSha256,
      chatProof:(sid,requestId)=>{
        const session=ctx.sessions.get(sid)
        if(!session)return
        assertWorkspaceSession(session)
        return chatAttachmentSources.readChatProof(session,requestId)??undefined
      },
      chatSourceCurrent:(sid,requestId)=>{
        const session=ctx.sessions.get(sid)
        if(!session)return false
        try {assertWorkspaceSession(session);chatCardSources.assertCurrent(session,requestId)
          return !!chatAttachmentSources.readChatProvenance(session,requestId)}
        catch {return false}
      },
      callMatches:(sid,callId,turn)=>{
        const session=ctx.sessions.get(sid),calls=session?eventsOf(session).filter(event=>event.type==='tool/call'
          &&event.data?.callId===callId):[]
        return calls.length===1&&calls[0]?.data?.name==='rp_card_import_begin'&&calls[0]?.data?.turn===turn
      },
      callRejected:(sid,callId,turn)=>{
        const session=ctx.sessions.get(sid),results=session?eventsOf(session).filter(event=>event.type==='tool/result'
          &&event.data?.turn===turn&&event.data?.message?.toolCallId===callId):[]
        if(results.length!==1)return false
        try {
          const result=JSON.parse(textOf(results[0]!.data?.message?.content)) as {ok?:unknown;inputPermissionUnknown?:unknown;error?:unknown}
          return result.ok===false&&result.inputPermissionUnknown!==true&&typeof result.error==='string'&&!!result.error
        } catch {return false}
      },
    },scope,descriptor),withSourceLock:(id,work)=>withImportLock(id,'input-management-terminal',work),
  }
  const schemaStory=mvuOpening.createSchemaStory({
    closingView:(lease,scope)=>inputOwner?.readClosingView(lease,scope),
    verifyConsumedScope:scope=>inputOwner?.verifyConsumedScope(scope)===true,
    verifyNative:completionDeps.verifyNative,readCanonical:completionDeps.readCanonical,
    readConsumedCanonical:completionDeps.readConsumedCanonical!,awaitOwnedCompletion,
  })
  completionDeps.schema=schemaStory
  if(schemaStory)schemaDerived=createRoleplayMvuSchemaDerived({tables:T,branch:T.branch,status:T.status,
    session:id=>ctx.sessions.get(id) as unknown as NativeSession|undefined,readSession:mvuAncestry.readSession,
    readSourceSha256:mvuOpening.readSourceSha256,readOpeningContext:openingContextBinding,
    importActiveKey,importRecordKey,withSourceLock:(id,work)=>withImportLock(id,'mvu-schema-derived',work),
    history:schemaStory})
  const completion=createRoleplayMvuStoryCompletion(completionDeps)
  inputOwner = createRoleplayInputPreparation({table:T.branch,completion,
    observe:(session:CoreSession) => mvuOpening.readInputObservation(session.id),
    preflightObservation:(session,signal)=>mvuOpening.preflightSchema(session.id,signal),
    onClosingRelease:mvuOpening.releaseSchemaClosing,
    awaitMutationBarrier:async(session,signal)=>{
      await mvuPlayer.awaitMutationBarrier(session,signal)
      await mvuOpening.awaitSchemaPlayerBarrier(session,signal)
    },mutationBlockCode:session=>mvuPlayer.mutationBlockCode(session)??mvuOpening.schemaPlayerMutationBlockCode(session),
    onMutationStop:(session,notice)=>{
      mvuOpening.invalidateSchemaSession(session.id)
      mvuPlayer.onMutationStop(session,notice)
    },
    onError:error => ctx.logger?.warn?.(`roleplay: input permission write is unknown: ${String(error)}`)})
  // Core outlives an individual Native factory/Agent. Releasing that exact
  // owner's hot binding permits a cold incarnation to bind the same durable
  // Session without transferring its old tokens or resending pending input.
  ctx.on('agent/disposed',({agent})=>{
    mvuOpening.invalidateSchemaAgent(agent)
    inputBindings.get(agent)?.dispose()
    inputBindings.delete(agent)
  },{global:true})
  ctx.effect(() => () => {
    for (const binding of inputBindings.values()) binding.dispose()
    inputBindings.clear()
  },'roleplay: native input owner')
  // Remounting Core cannot invent a marker for an old turn. Register only the
  // actual retained Agent so its next native input can acquire its own marker.
  for (const agent of ctx.agents?.list() ?? []) {
    await history.ready(agent.session)
    if(agent.session.header?.isSeeded)await mvuAncestry.ready(agent.session)
    attachInputOwner(agent)
  }
  registerMvuPlayerRoutes({ctx,resolveRoleplaySession:async id=>{
    const session=await resolveRoleplaySession(id)
    if(session)await ensureBranch(session)
    return session
  },player:{observe:mvuPlayer.observe,submit:input=>{
    const id=(input as {sessionId?:unknown})?.sessionId
    return typeof id==='string'&&mvuOpening.hasSchemaOpening(id)?mvuOpening.submitSchemaPlayer(input):mvuPlayer.submit(input)
  }},observe:observeNumericalState})
  registerOpeningRoutes({ctx,resolveRoleplaySession:async id => {
    const session = await resolveRoleplaySession(id)
    // Opening basis needs a ready branch, but general branch resolution must
    // leave inheritance to its caller's exact cadence/fork boundary options.
    if (session) await ensureBranch(session)
    return session
  },selection:openingSelection,
    openingContext,
    legacyOpeningAlreadyRequested:(sessionId,importId) => {
      const pointer = T.branch.get(importActiveKey(sessionId)) as {sourceRecordSessionId?:string} | undefined
      const record = T.branch.get(importRecordKey(pointer?.sourceRecordSessionId ?? sessionId,importId)) as
        {workflowId?:string} | undefined
      const job = record?.workflowId
        ? T.branch.get(cardWorkflowKey(record.workflowId)) as {openingRequested?:boolean} | undefined
        : undefined
      return job?.openingRequested === true
    },
    priorOpeningInHistory:session => {
      const prelude = provenImportPreludeAssistants(session,
        activeOpeningSource(T.branch, session.id))
      const inherited = T.branch.get(keyOf(session.id, 'meta')) as
        {freshBranchFrom?: unknown} | undefined
      if (typeof inherited?.freshBranchFrom === 'string' && inherited.freshBranchFrom) return true
      const internal = internalTaskSeqs(session)
      return surfaceEvents(session).some(event => event.type === 'assistant/message'
        && !internal.has(event.seq) && !prelude.has(event.seq)
        && textOf(event.data?.message?.content).trim())
        || eventsOf(session).some(event => {
          if (event.type !== 'assistant/message') return false
          const source = event.data?.message?.source as
            {kind?:unknown;producer?:unknown;origin?:unknown} | undefined
          return source?.kind === 'programmatic' && source.producer === 'dsh-nexttavern'
            && typeof source.origin === 'string' && source.origin.startsWith('card-opening:')
        })
    },
    canCommit:async sessionId => {
      const found = await ctx.sessionController.resolveAgent(sessionId)
      const owned = ctx.get('agentLoop')?.getInputAdmissionAgent(found?.agent)
      return !!owned && owned === found?.agent
        && typeof (owned as typeof owned & {commitProgrammaticAssistant?:unknown}).commitProgrammaticAssistant === 'function'
    }})

  registerCardAuthoring({
    ctx,
    T,
    svc,
    RULE_TEXT_FIELDS,
    sessionOf,
    beforeWrite: beforeAdaptationWrite,
  })

  registerSessionTools({ ctx, T, simpleTool, sessionOf })

  registerDraftCheck({
    ctx,
    sessionOf: workspaceSessionOf,
    beforeWrite: beforeAdaptationWrite,
  })

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
    enhancements: async session => {
      const info: Record<string, unknown> = {}
      try {
        info.retrieval = await retrieval.diagnose(session)
      } catch {
        info.retrieval = {
          available: false,
          reason: 'RETRIEVAL_STATE_UNAVAILABLE',
        }
      }
      try {
        const preset = narrativePresets.policy(session.id)
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
        }
      } catch {
        info.presets = {
          available: false,
          reason: 'PRESET_STATE_UNAVAILABLE',
        }
      }
      try {
        const owner = ctx.get('tavernConversations')?.rootOf(session.id) ?? session.id
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
        }
      } catch {
        info.research = {
          available: false,
          reason: 'RESEARCH_STATE_UNAVAILABLE',
        }
      }
      return info
    },
  })

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
  })

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
    numericalState:observeNumericalState,
    chatImportProjection:(session,record) => {
      // A historical attachment receipt alone must never open a choice for a
      // cancelled, replaced, inherited or incompletely activated import.
      if (record.status !== 'active' || record.sessionId !== session.id || !record.workflowId) return null
      const job = cardWorkflows(session).find(value => value.id === record.workflowId)
      const result = job?.result
      if (!job || job.status !== 'completed' || job.kind !== 'card-import'
        || job.generation !== record.workflowGeneration || job.source.sha256 !== record.rawSha256
        || !result || typeof result !== 'object' || !('importId' in result)
        || result.importId !== record.importId || !job.clientRequestId) return null
      try {
        assertWorkspaceSession(session)
        // Completed imports retain their validated archival identity even when
        // management-message retirement removes the old request from surface.
        // Current active import/transaction and the opening catalog own readiness.
        const proof = chatAttachmentSources.readChatProvenance(session,job.clientRequestId)
        if (!proof || proof.sourceSha256 !== record.rawSha256 || !record.activation?.transactionId) return null
        return {...proof,importId:record.importId,rawSha256:record.rawSha256,transactionId:record.activation.transactionId}
      } catch {return null}
    },
    deletedBranchMessageIdsFor,
    inheritedAssistantMessageIdsFor,
    normalizeDecisionRecord,
    userValues,
    svc,
    resolveRoleplaySession,
  })

  const maintenanceJobs = new Map<string, MaintenanceRouteJob>()
  ctx.effect(() => ctx.connection.fetch.register({requestBody: 'buffered',
    path: '/api/roleplay/card-adaptation',
    methods: ['GET', 'POST'],
    fetch: async request => {
      try {
        const url = new URL(request.url)
        const body = request.method === 'POST'
          ? await request.json() as Record<string, unknown>
          : null
        const session = await resolveRoleplaySession(
          body?.sessionId ?? url.searchParams.get('sessionId'),
        )
        if (!session) {
          return new Response(
            JSON.stringify({ ok: false, error: '角色扮演对话不存在' }),
            { status: 404, headers: { 'content-type': 'application/json' } },
          )
        }
        assertWorkspaceSession(session)
        const result = body
          ? await adaptation.mutate(session, body)
          : await adaptation.view(
            session,
            url.searchParams.get('sourceId') ?? undefined,
            Number(url.searchParams.get('cursor') ?? 0),
            url.searchParams.get('query') ?? '',
            url.searchParams.get('noteMode') ?? 'close-reading',
          )
        if (
          body?.action === 'research-mode'
          && body.readingMode === 'coarse'
          && result
          && typeof result === 'object'
          && 'code' in result
          && result.code === 'ADAPTATION_COARSE_MODEL_REQUIRED'
        ) {
          taskAgents.get(session.id)?.cancel?.(
            {
              kind: 'hook',
              reason: '粗颗粒度模式尚未配置可用的小说检索模型，本轮已停止；请先在长文本转角色卡中配置模型。',
            },
            { keepInbox: true },
          )
        }
        return new Response(
          JSON.stringify(result),
          { headers: { 'content-type': 'application/json' } },
        )
      } catch (error) {
        const message = String((error as Error).message)
        return new Response(
          JSON.stringify({ ok: false, error: message }),
          {
            status: message.includes('已更新') ? 409 : 400,
            headers: { 'content-type': 'application/json' },
          },
        )
      }
    },
  }), 'roleplay: novel adaptation management')
  registerTelemetryRoutes({
    ctx,
    resolveRoleplaySession,
    exchangeRates,
    priceCatalog,
    telemetry,
  })
  ctx.effect(() => ctx.connection.fetch.register({requestBody: 'buffered',
    path: '/api/roleplay/retrieval-confirmations',
    methods: ['GET', 'POST'],
    fetch: async request => {
      try {
        const url = new URL(request.url)
        const body = request.method === 'POST'
          ? await request.json() as Record<string, unknown>
          : null
        const session = await resolveRoleplaySession(
          body?.sessionId ?? url.searchParams.get('sessionId'),
        )
        if (!session) throw Error('角色扮演会话不存在')
        const result = body
          ? await retrieval.resolveRebuild(session, String(body.id), String(body.action))
          : { ok: true, pending: retrieval.pendingRebuilds(session) }
        return Response.json(result)
      } catch (error) {
        return Response.json(
          { ok: false, error: String((error as Error).message) },
          { status: 409 },
        )
      }
    },
  }), 'roleplay: semantic index rebuild confirmation')
  ctx.effect(() => ctx.connection.fetch.register({requestBody: 'buffered',
    path: '/api/roleplay/memory-retrieval',
    methods: ['GET', 'POST'],
    fetch: async request => {
      try {
        const url = new URL(request.url)
        const body = request.method === 'POST'
          ? await request.json() as Record<string, unknown>
          : null
        const session = await resolveRoleplaySession(
          body?.sessionId ?? url.searchParams.get('sessionId'),
        )
        if (!session) {
          return new Response(
            JSON.stringify({ ok: false, error: '角色扮演会话不存在' }),
            { status: 404, headers: { 'content-type': 'application/json' } },
          )
        }
        const result = body
          ? await retrieval.mutate(session, body)
          : url.searchParams.get('action') === 'search'
            ? await retrieval.search(session, Object.fromEntries(url.searchParams))
            : await retrieval.view(session)
        return new Response(
          JSON.stringify({ ok: true, ...result }),
          { headers: { 'content-type': 'application/json' } },
        )
      } catch (error) {
        const message = String((error as Error).message)
        return new Response(
          JSON.stringify({ ok: false, error: message }),
          {
            status: message.includes('已更新') ? 409 : 400,
            headers: { 'content-type': 'application/json' },
          },
        )
      }
    },
  }), 'roleplay: retrieval management')

  const { startExportJob } = registerJobRoutes({
    ctx,
    T,
    resolveRoleplaySession,
    novelExports,
    modelPolicy,
    beginCardWorkflow,
    resumeCardWorkflows,
    cardWorkflows,
    cardWorkflowKey,
    tavernTasks,
    taskAgents,
    libraryFor,
    migrateResources,
  })
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
  })

  registerAvatarRoute({
    ctx,
    T,
    resolveRoleplaySession,
    ensureBranch,
    awaitImportBarrier,
    importRecordKey,
    assertImportRecordIntegrity,
  })
  registerMaintenanceRoute({
    ctx,
    resolveRoleplaySession,
    maintenanceJobs,
    latestStatusEvent,
    runStatusObligation,
    selectedStatusRecord,
  })

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
    prepareDerivedBasis:async(operation,reservation)=>{
      if(mvuOpening.hasSchemaOpening(reservation.sourceSessionId)) {
        if(!schemaDerived)throw Error('SCHEMA_DERIVED_RUNTIME_UNAVAILABLE')
        await schemaDerived.prepare(operation,reservation)
      }else await mvuDerived.prepare(operation,reservation)
    },
    numericalForkBlockCode:id=>mvuOpening.hasSchemaOpening(id)
      ?mvuOpening.schemaPlayerMutationBlockCode(ctx.sessions.get(id)!) :undefined,
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
    locateProgrammaticOpeningTarget,
    bootstrapChildBranch,
    registerRecoveryFork,
    registerNativeFork,
    forkAnchorLockKey,
    requestUserEvent,
    forkPendingKey,
    reconcileNativeFork,
    failPendingNativeFork,
    replaceAssistantText,
    replaceUserText,
  })

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
  })
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
      const catalog = ctx.get('tavernConversations')
      if (!catalog) return null
      const root = catalog.rootOf(session.id)
      const book = catalog.snapshot().conversations[root]
      return !book || book.activeSessionId === session.id
        ? `${root}:${book?.selectionRevision ?? 0}:${session.id}`
        : null
    },
    evidence: async (session, name, args) => adaptation.readForRepair(
      await workspaceSessionOf({ agent: { session } }),
      name,
      args,
    ),
  })

  ctx.logger?.info?.('roleplay-core: mounted')
}
