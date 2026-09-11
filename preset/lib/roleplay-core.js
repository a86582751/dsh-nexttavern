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

import { createHash, randomUUID, randomInt } from 'node:crypto'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { readCardSource, decodeTavernCard, projectTavernCard, fenceCardContent } from './tavern-card.js'
import { boundedRegexMatch, worldbookRegex } from './bounded-regex.js'
import {createCharacterCluster,CHARACTER_PERSONA,clusterSettings} from './character-cluster.js'
import { registerCardExport } from './card-export.js'
import { createModelPolicy, createTavernTasks, selectedMainRoute, withTavernLock, isInlinePending, taskPhaseMessage, taskStorySeqs, internalTaskSeqs, inlineTaskInstruction, inlineTaskMessages, retireCompletedTaskContexts, awaitTaskAdmissions, tavernTaskToolBoundary, TaskValidationError, taskValidationFailure } from './tavern-tasks.js'
import { createTavernLibrary } from './tavern-library.js'
import { createNovelExports } from './novel-export.js'
import { createTelemetry, aggregateUsage, timeRange, queryUsageRequests } from './tavern-telemetry.js'
import { createPriceCatalog, createExchangeRates, convertUsageCurrency } from './tavern-pricing.js'

export const name = 'roleplay-core'
const RULE_TEXT_FIELDS = ['core', 'plot', 'narrative', 'reply', 'style']
const RULE_IMPORT_FIELDS = {'core-setting':'core','plot-guidance':'plot','rule-narrative':'narrative','rule-reply':'reply','rule-style':'style'}
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
]

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
}

const DOMAIN_NAME = 'roleplay'
const DOMAIN_VERSION = 1

// ── 小工具 ──────────────────────────────────────────────────────────────────

// storage-json 的 per-record 布局要求键 path-safe（/^[a-zA-Z0-9_-]+$/），
// 冒号不可用：以双下划线分隔 branchId 与子键（session id 只含 [a-z0-9-]）。
const keyOf = (branchId, sub) => `${branchId}__${sub}`

// 用户级信息（{{user}}/{{user_gender}} 数据源）：独立文件存储，不依赖任何会话
// （设置页路由由 dsh-roleplay-ui 宿主半注册，开机即存在）。
const userInfoPath = () =>
  process.env.DSH_ROLEPLAY_USERINFO_PATH ??
  join(process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh'), 'roleplay-userinfo.json')

function readUserInfo() {
  try {
    const raw = readFileSync(userInfoPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeUserInfo(record) {
  try {
    const p = userInfoPath()
    mkdirSync(join(p, '..'), { recursive: true })
    const temp = `${p}.tmp-${process.pid}-${Date.now()}`
    writeFileSync(temp, JSON.stringify(record, null, 2), 'utf8')
    renameSync(temp, p)
  } catch {}
}

function textOf(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n')
}

function eventsOf(session) {
  if (Array.isArray(session?.events)) return session.events
  if (Array.isArray(session?.log)) return session.log
  return []
}

function lastSeq(session) {
  if (Number.isSafeInteger(session?.seq)) return Number(session.seq) - 1
  const events = eventsOf(session)
  return events.length > 0 ? events.length - 1 : -1
}

function durableSeq(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null
}

function provenanceSeq(item) {
  if (!item || typeof item !== 'object') return null
  const candidates = [
    item.atSeq, item.evidenceSeq, item.updatedAtSeq, item.checkpointSeq,
    item.sourceSeq, item.seq, item.range?.end,
  ]
  for (const candidate of candidates) {
    const seq = durableSeq(candidate)
    if (seq !== null) return seq
  }
  return null
}

function estimateTokens(text) {
  // 中文约 1 token/字，英文约 4 字符/token；取一个偏保守的近似。
  return Math.ceil(String(text ?? '').length / 2.5)
}

function sha256(text) {
  return createHash('sha256').update(Buffer.isBuffer(text) ? text : String(text ?? ''), 'utf8').digest('hex')
}

function safeId(raw) {
  const value = String(raw ?? '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64)
  return value || `generated-${randomUUID().slice(0, 8)}`
}

/** Stable path-safe id for imported entries; CJK labels retain identity via hash. */
function stableImportId(raw) {
  const label = String(raw ?? '').normalize('NFKC').trim()
  if (!label) throw new Error('card/worldbook assignment 必须提供非空 id 或 name')
  if (/^[a-zA-Z0-9_-]{1,64}$/.test(label)) return label
  const stem = label
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44)
  const digest = sha256(label).slice(0, 16)
  return `${stem || 'entry'}-${digest}`
}

function cloneRecord(value) {
  return value === undefined ? undefined : structuredClone(value)
}

function stableJson(value) {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
}

function recordSha256(value) {
  return value === undefined ? 'missing' : sha256(stableJson(value))
}

function isPathWithin(root, candidate) {
  const rel = relative(root, candidate)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

/** Mirror scripts/deescape-md.mjs without modifying the converter artefact. */
function deescapeMarkdown(text) {
  return String(text ?? '')
    // Keep BOM in rawSource, but do not let it hide the first Markdown marker
    // from the normalized classifier view.
    .replace(/^\uFEFF/, '')
    .replace(/^([ \t]*)\\(#{1,6})(?=\s)/gm, '$1$2')
    .replace(/^([ \t]*)\\(>+)/gm, '$1$2')
    .replace(/^([ \t]*)\\([-*+])(?=\s)/gm, '$1$2')
    .replace(/^([ \t]*)\\(\d+[.)])(?=\s)/gm, '$1$2')
    .replace(/^([ \t]*)\\([-*_])\2{2,}\s*$/gm, (match, indent) => `${indent}${match.slice(indent.length + 1)}`)
    .replace(/^([ \t]*)\\(`{3,}|~{3,})/gm, '$1$2')
    // Standard HTML tags are structurally unambiguous and may occur inline.
    // Keep unknown/custom `\<not-a-tag\>` text escaped rather than guessing.
    .replace(/\\(<\/?(?:a|abbr|article|aside|audio|b|blockquote|body|br|button|canvas|caption|circle|code|col|colgroup|data|datalist|dd|defs|del|details|dialog|div|dl|dt|em|fieldset|figcaption|figure|footer|form|g|h[1-6]|head|header|hr|html|i|iframe|img|input|ins|kbd|label|legend|li|line|linearGradient|link|main|map|mark|menu|meta|meter|nav|noscript|object|ol|optgroup|option|output|p|path|picture|polygon|polyline|pre|progress|q|rect|rp|rt|ruby|s|samp|script|section|select|slot|small|source|span|stop|strong|style|sub|summary|sup|svg|symbol|table|tbody|td|template|text|textarea|tfoot|th|thead|time|title|tr|track|u|ul|use|var|video|wbr)(?=[\s/>]|\\>)[^>\r\n]*?(?:\\)?>)/gi,
      (_match, tag) => tag.replace(/\\>$/, '>'))
    // Complete Markdown links/images and table rows are safe to restore;
    // isolated `\[`/`\|` in prose, LaTeX and regexes remain byte-identical.
    .replace(/^([ \t]*)(\\!)?\\(\[[^\r\n\]]*(?:\\)?\]\([^\r\n]*\))/gm,
      (_match, indent, image, link) => `${indent}${image ? '!' : ''}${link.replace(/\\\]/, ']')}`)
    .replace(/^([ \t]*)(\\\|[^\r\n]*\\\|[^\r\n]*)$/gm,
      (_match, indent, row) => `${indent}${row.replace(/\\\|/g, '|')}`)
    // Roleplay status templates rely on these tokens being executable after
    // import. Restore only a complete pair; ordinary JS/CSS braces are kept.
    // Do not expose a literal double-brace example to the system-prompt
    // templater; normalized card text keeps the placeholder escaped until the
    // status renderer intentionally expands it.
    .replace(/\\\{\\\{([^{}\r\n]{1,200})\\\}\\\}/g, '{{$1}}')
}

function passthroughSchema() {
  return {
    parse(v) {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) {
        throw new Error('roleplay domain record must be a JSON object')
      }
      return v
    },
    safeParse(v) {
      try {
        return { success: true, data: this.parse(v) }
      } catch (error) {
        return { success: false, error }
      }
    },
  }
}

function rollsSchema() {
  const normalize = (value) => {
    // alpha.3 roleplay builds before this repair wrote the log as a bare
    // Array even though the shared passthrough schema rejected arrays. Accept
    // and normalize that durable legacy shape while opening the domain.
    if (Array.isArray(value)) {
      return { schemaVersion: 1, entries: value.slice(-200), updatedAt: 0 }
    }
    if (value === null || typeof value !== 'object') {
      throw new Error('roleplay rolls record must be a JSON object or legacy array')
    }
    return value
  }
  return {
    parse: normalize,
    safeParse(value) {
      try { return { success: true, data: normalize(value) } }
      catch (error) { return { success: false, error } }
    },
  }
}

function rollLogEntries(value) {
  if (Array.isArray(value)) return value
  return Array.isArray(value?.entries) ? value.entries : []
}

function rollLogRecord(entries) {
  return { schemaVersion: 1, entries: [...entries].slice(-200), updatedAt: Date.now() }
}

function extractJson(raw) {
  let text = String(raw ?? '').trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()
  try {
    return JSON.parse(text)
  } catch {}
  // 回退：取第一个平衡花括号块
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1))
        } catch {}
        return null
      }
    }
  }
  return null
}

// Native task transport. Same-model work yields to the existing Agentic Loop.
async function llmJson(ctx, route, options) {
  return ctx.get('roleplay').nativeTask({ ...options, ...route, format: 'json' })
}
async function llmText(ctx, route, options) {
  return ctx.get('roleplay').nativeTask({ ...options, ...route, format: 'text' })
}
// ── 表面折叠（正文原文窗口）──────────────────────────────────────────────────

/**
 * 按模型真实可见的 surface 顺序读取当前分支正文。
 *
 * Session 的 log 是不可变审计日志：被重生、删除或分支切换遮蔽的旧消息仍会
 * 永久留在其中。剧情回忆、记忆、导出若扫描整个 log，就会把未选分支重新
 * 混回正史。`session.surface.nodes` 才是下一次请求真正会发送的唯一投影。
 */
function surfaceEvents(session) {
  const log = eventsOf(session)
  const nodes = session?.surface?.nodes
  if (!log.length || !nodes || typeof nodes[Symbol.iterator] !== 'function') return []
  const out = []
  for (const seq of nodes) {
    const e = log[Number(seq)]
    if (e) out.push(e)
  }
  return out
}

// Only ephemeral Phase-A projections are superseded. Replacing each exact
// source node preserves native request reconstruction and every audit event;
// no story/tool range is flattened and current fixed settings stay complete.
// Keep identical author system sections byte-identical across requests. The
// content-derived fence belongs to this exact content, not to a model step or
// process. Bound memoization without changing rendered bytes on eviction.
const promptSafeAuthorText = text => String(text).replace(/\{\{(?:user|user_gender|char)\}\}|\{\{|\}\}/g,
  token => token==='{{'?'⟦':token==='}}'?'⟧':token)
export function createStableRoleplayFence() {
  const entries=new Map();let size=0
  return (body,kind)=>{
    const key=sha256(`${kind}\0${body}`),cached=entries.get(key)
    if(cached){entries.delete(key);entries.set(key,cached);return cached}
    const fenced=fenceCardContent(promptSafeAuthorText(body),kind,{stable:true})
    entries.set(key,fenced);size+=fenced.length
    while(entries.size>64||size>8_000_000){const oldest=entries.keys().next().value;size-=entries.get(oldest).length;entries.delete(oldest)}
    return fenced
  }
}
export function readRoleplayActivity(session,preparation,jobs=[],now=Date.now()) {
  const events=eventsOf(session),startIndex=events.findLastIndex(e=>e.type==='turn/start'),start=events[startIndex],turn=start?.data?.turn??null
  // Progress polling examines only the current turn, never old token chunks.
  const tail=startIndex>=0?events.slice(startIndex+1):[]
  const end=tail.findLast(e=>e.type==='turn/end'&&e.data?.turn===turn)
  const phase=tail.findLast(e=>e.type==='user/message'&&e.data?.source?.plugin==='roleplay-tasks'&&e.data?.source?.form==='phase')
  const active=jobs.filter(j=>j.sessionId===session.id&&['queued','running'].includes(j.status))
  // Quiet notes may span turns; they never extend the player's foreground wait.
  const backgroundJobs=active.filter(j=>j.background===true)
  const work=active.filter(j=>j.background!==true&&j.createdAt>=(start?.time??0))
  const running=Boolean(start&&!end||work.some(j=>j.execution==='spawn'&&j.status==='running'))
  const admitted=['story','after-story'].includes(phase?.data?.source?.stage)
  const preparing=!admitted&&preparation?.sessionId===session.id&&preparation.turn===turn&&preparation.status==='preparing'
  const original=preparing?preparation.messages?.findLast(m=>m.role==='user'&&m.source?.kind==='user'):null
  const visibleNodes=new Set(session?.surface?.nodes??[])
  const observed=original&&tail.some(e=>visibleNodes.has(e.seq)&&e.type==='user/message'&&e.data?.id===original.id&&e.data?.source?.kind==='user')
  const pendingPlayer=original&&!observed?{messageId:original.id,text:textOf(original.content),attachmentCount:(original.content??[]).filter(b=>b.type==='image').length,time:preparation.createdAt}:null
  let stage=!running?'done':preparing?'prepare':phase?.data?.source?.stage==='story'?'story':work.some(j=>j.kind==='memory')?'memory':work.some(j=>j.kind==='status')?'status':work.some(j=>j.kind==='decision')?'decision':phase?'management':'story'
  if(!running&&(pendingPlayer||work.length))stage='paused'
  const step=tail.findLast(e=>e.type==='step/start')
  const storyStep=running&&!end&&stage==='story'&&phase?.data?.source?.stage==='story'&&Number.isSafeInteger(step?.data?.step)?step.data.step:null
  const proof=tail.findLast(e=>e.type==='user/message'&&e.data?.source?.kind==='plugin'&&e.data.source.plugin==='roleplay-tasks'&&e.data.source.stage==='after-story'&&Number.isSafeInteger(e.data.source.storySeq))
  const proofBody=events[proof?.data?.source?.storySeq]
  const provenSeq=proofBody?.type==='assistant/message'&&proofBody.data?.turn===turn&&Array.from(session?.surface?.nodes??[]).includes(proofBody.seq)?proofBody.seq:null
  return {schemaVersion:1,sessionId:session.id,turn,running,stage,startedAt:start?.time??null,
    phaseSeq:phase?.seq??null,storyStep,
    elapsedMs:start?Math.max(0,(running?now:end?.time??now)-start.time):0,observedAt:now,pendingPlayer,
    storySeq:provenSeq??(end?canonicalAssistantForTurn(session,turn)?.seq??null:null),
    jobs:work.map(j=>({kind:j.kind,status:j.status,execution:j.execution})),
    backgroundJobs:backgroundJobs.map(j=>({kind:j.kind,status:j.status,execution:j.execution,createdAt:j.createdAt}))}
}
export function retireRoleplayContexts(session,turn) {
  // A replacement before the previous player message destroys the cached
  // prefix for the completed request. Context anchors are append-only now;
  // Phase A marks the newest visible anchor as authoritative. Window rollover
  // naturally removes obsolete anchors with its contiguous old-story range.
  void session
  void turn
  return 0
}

function surfaceEntries(session) {
  const surface = surfaceEvents(session)
  const internal = internalTaskSeqs(session)
  const committedStory = taskStorySeqs(session)
  const completed = new Set(surface
    .filter((event) => isCompletedTurnEnd(event))
    .map((event) => Number(event.data?.turn))
    .filter(Number.isSafeInteger))
  // One turn may contain several assistant/message events (tool preambles,
  // retries, and the final prose). Expose only the last visible, non-interrupted
  // prose message for that turn. The audit log still retains every event.
  const canonicalByTurn = new Map()
  for (const event of surface) {
    if (event?.type !== 'assistant/message' || event.data?.interrupted === true || internal.has(event.seq)) continue
    const text = textOf(event.data?.message?.content)
    if (!text.trim()) continue
    const turn = Number(event.data?.turn)
    const key = Number.isSafeInteger(turn) ? turn : `seq:${event.seq}`
    if (completed.size === 0 || completed.has(turn) || committedStory.has(event.seq) || !Number.isSafeInteger(turn)) canonicalByTurn.set(key, event)
  }
  const out = []
  for (const e of surface) {
    if (e.type === 'user/message') {
      if(internal.has(e.seq))continue
      const src = e.data?.source
      // 普通玩家输入，以及分支投影中按原文恢复的玩家输入；后台上下文、
      // compact checkpoint、重生指令和工具材料都不属于剧情正文。
      if (src?.kind !== 'user' && !(src?.kind === 'plugin' && src?.plugin === 'roleplay' && src?.form === 'branch-user')) continue
      const text = textOf(e.data?.content)
      if (text.trim()) out.push({
        seq: e.seq,
        kind: 'user',
        text,
        messageId: String(e.data?.id ?? ''),
        time: Number(e.time) || 0,
      })
    } else if (e.type === 'assistant/message') {
      const text = textOf(e.data?.message?.content)
      const turn = Number(e.data?.turn)
      const key = Number.isSafeInteger(turn) ? turn : `seq:${e.seq}`
      if (text.trim() && canonicalByTurn.get(key) === e) out.push({
        seq: e.seq,
        kind: 'assistant',
        text,
        messageId: String(e.data?.message?.id ?? ''),
        turn: Number(e.data?.turn),
        step: Number(e.data?.step),
        time: Number(e.time) || 0,
      })
    }
  }
  return out
}

function isCompletedTurnEnd(event) {
  return event?.type === 'turn/end' && event.data?.reason?.kind === 'completed'
}

const canonicalAssistantCache = new WeakMap()
function canonicalAssistantForTurn(session, turn) {
  const events=eventsOf(session),nodes=Array.from(session?.surface?.nodes??[]),surfaceKey=nodes.join(',')
  const cached=canonicalAssistantCache.get(session)
  if(cached?.events===events&&cached.length===events.length&&cached.last===events.at(-1)&&cached.surfaceKey===surfaceKey)return cached.byTurn.get(Number(turn))??null
  const completed = new Set(events.filter(isCompletedTurnEnd).map(e=>Number(e.data?.turn)))
  const internal = internalTaskSeqs(session)
  const committedStory = taskStorySeqs(session)
  const visible = new Set(nodes.map(Number)),byTurn=new Map()
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index],numericTurn=Number(event?.data?.turn)
    if (event?.type !== 'assistant/message' || byTurn.has(numericTurn)) continue
    if (!visible.has(Number(event.seq)) || event.data?.interrupted === true || internal.has(event.seq)) continue
    if (!completed.has(numericTurn) && !committedStory.has(event.seq)) continue
    if (textOf(event.data?.message?.content).trim()) byTurn.set(numericTurn,event)
  }
  canonicalAssistantCache.set(session,{events,length:events.length,last:events.at(-1),surfaceKey,byTurn})
  return byTurn.get(Number(turn))??null
}

function visibleCompactionCheckpoint(session) {
  for (const event of [...surfaceEvents(session)].reverse()) {
    if (event?.type !== 'user/message' || event.data?.source?.kind !== 'plugin' || event.data?.source?.plugin !== 'compact') continue
    const raw = textOf(event.data?.content)
    const match = raw.match(/<compacted-summary>\s*([\s\S]*?)\s*<\/compacted-summary>/i)
    if (match?.[1]?.trim()) return { text: match[1].trim(), seq: Number(event.seq) }
  }
  return null
}

/** 最近 ~budgetTokens 的正文窗口（拼接文本）。 */
function recentWindow(session, budgetTokens) {
  const entries = surfaceEntries(session)
  const picked = []
  let used = 0
  for (let i = entries.length - 1; i >= 0; i--) {
    const cost = estimateTokens(entries[i].text)
    if (used + cost > budgetTokens && picked.length > 0) break
    picked.push(entries[i])
    used += cost
    if (used >= budgetTokens) break
  }
  picked.reverse()
  return picked.map((e) => `[seq ${e.seq}] (${e.kind === 'user' ? '用户' : '正文'})\n${e.text}`).join('\n\n')
}

/**
 * Read only the selected branch's story after a roleplay context-window
 * boundary.  The append-only session log remains the source of truth; this
 * projection is deliberately suffix-only so a sibling branch can never leak
 * into the new model-visible window.
 */
export function recentWindowSince(session, startSeq, budgetTokens) {
  const boundary = Number.isSafeInteger(Number(startSeq)) ? Number(startSeq) : -1
  const entries = surfaceEntries(session).filter((entry) => Number(entry.seq) > boundary)
  const picked = []
  let used = 0
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const cost = estimateTokens(entries[index].text)
    if (picked.length > 0 && used + cost > budgetTokens) break
    picked.push(entries[index])
    used += cost
    if (used >= budgetTokens) break
  }
  picked.reverse()
  return picked.map((entry) => `[seq ${entry.seq}] (${entry.kind === 'user' ? '用户' : '正文'})\n${entry.text}`).join('\n\n')
}

function roleplayMessageText(message) {
  return Array.isArray(message?.content)
    ? message.content.filter((block) => block?.type === 'text' && typeof block.text === 'string').map((block) => block.text).join('\n')
    : ''
}

function roleplayMessageIsStory(message) {
  if (!message || typeof message !== 'object') return false
  // Assistant messages carry provider/model metadata rather than a
  // `source.kind === "model"` marker in Harness. Treat every assistant
  // message as narrative here; tool calls/results remain separate messages.
  if (message.role === 'assistant') return true
  return message.role === 'user' && message.source?.kind === 'user'
}

/**
 * Keep fixed roleplay injections plus the newest complete story tail.  This
 * intentionally differs from Codex's empty new-context window: RP needs the
 * latest prose to preserve voice, active gestures, and immediate state-bar
 * continuity.  Historical messages remain durable and are recalled through
 * rp_history instead of being silently deleted.
 */
function retainRoleplayContinuityTail(messages, budgetTokens) {
  const list = Array.isArray(messages) ? messages : []
  const story = list.filter(roleplayMessageIsStory)
  const keep = new Set()
  let used = 0
  for (let index = story.length - 1; index >= 0; index -= 1) {
    const cost = estimateTokens(roleplayMessageText(story[index]))
    if (keep.size > 0 && used + cost > budgetTokens) break
    keep.add(story[index])
    used += cost
  }
  return list.filter((message) => !roleplayMessageIsStory(message) || keep.has(message))
}

function messageIdOf(message) {
  const value = message?.id ?? message?.message?.id
  return value === undefined || value === null ? '' : String(value)
}

function internalMaintenanceMessageIds(session) {
  const ids = new Set(), calls = new Set()
  const events = eventsOf(session), internal = internalTaskSeqs(session)
  let inMaintenance = false
  for (const event of events) {
    if (event?.type === 'turn/start' || event?.type === 'turn/end') inMaintenance = false
    const source = event?.type === 'user/message' ? event.data?.source : null
    if (source?.kind === 'plugin' && source.plugin === 'roleplay-tasks' && source.form === 'phase') {
      inMaintenance = source.stage !== 'story'
    }
    if (event?.type === 'assistant/message' && internal.has(Number(event.seq))) {
      const id = messageIdOf(event.data?.message)
      if (id) ids.add(id)
      for (const block of event.data?.message?.content ?? []) {
        if (block?.type === 'tool-call' && block.id !== undefined && block.id !== null) calls.add(String(block.id))
      }
    }
    if (inMaintenance && event?.type === 'tool/call') {
      const callId = event.data?.callId ?? event.data?.id
      if (callId !== undefined && callId !== null) calls.add(String(callId))
    }
  }
  for (const event of events) {
    if (event?.type !== 'tool/result') continue
    const callId = event.data?.message?.source?.callId ?? event.data?.callId
    if (callId === undefined || callId === null || !calls.has(String(callId))) continue
    const id = messageIdOf(event.data?.message)
    if (id) ids.add(id)
  }
  return { ids, calls }
}

/** The hard-window tail contains prose plus selected player context only.
 * Internal results are identified from durable phase/call provenance, never text. */
export function retainRoleplayWindowContinuity(session, messages, budgetTokens) {
  const maintenance = internalMaintenanceMessageIds(session)
  const selected = (Array.isArray(messages) ? messages : []).filter((message) => {
    const source = message?.source
    if (source?.kind === 'plugin' && ['roleplay-tasks', 'roleplay-context'].includes(source.plugin)) return false
    const id = messageIdOf(message)
    if (id && maintenance.ids.has(id)) return false
    const callId = source?.callId ?? message?.callId
    if (callId !== undefined && callId !== null && maintenance.calls.has(String(callId))) return false
    // A tool-call assistant message cannot be carried without its paired tool
    // result. This window needs prose continuity, so retain neither half.
    if ((message?.content ?? []).some((block) => block?.type === 'tool-call' || block?.type === 'tool-result')) return false
    return roleplayMessageIsStory(message)
  })
  return retainRoleplayContinuityTail(selected, budgetTokens)
}

/** Include only contiguous old-window roleplay anchors immediately before the
 * first evicted player/body node; cards and user facts remain untouched. */
export function roleplayWindowCutStartIndex(surface, storyStartIndex) {
  let index = Math.max(0, Number(storyStartIndex) || 0)
  while (index > 0) {
    const event = surface[index - 1]
    const source = event?.type === 'user/message' ? event.data?.source : null
    if (source?.kind !== 'plugin' || source.plugin !== 'roleplay-context') break
    index -= 1
  }
  return index
}

/** 指定 seq 集合的表面原文（供记忆引擎压缩时取文）。 */
function surfaceTextForSeqs(session, seqs) {
  const want = new Set(seqs)
  const parts = []
  for (const e of surfaceEntries(session)) {
    if (want.has(e.seq)) parts.push(e.text)
  }
  return parts.join('\n\n')
}

// ── 世界书检索（纯本地，确定性）──────────────────────────────────────────────

function renderWorldbookEntry(e) {
  const lines = []
  lines.push(`【${e.name ?? e.id}】(id: ${e.id}, 类型: ${e.kind ?? 'term'}, 优先级: ${e.priority ?? 0}${e.locked ? ', 锁定' : ''})`)
  if (Array.isArray(e.aliases) && e.aliases.length) lines.push(`别名：${e.aliases.join('、')}`)
  if (Array.isArray(e.keywords) && e.keywords.length) lines.push(`关键词：${e.keywords.join('、')}`)
  if (e.content) lines.push(e.content)
  return lines.join('\n')
}

export async function retrieveWorldbook(T, branchId, userText, scene, budgetTokens) {
  const prefix = `${branchId}__`
  const entries = []
  for (const [k, v] of T.worldbook.entries()) {
    if (!k.startsWith(prefix) || !v || v.enabled === false) continue
    entries.push(v)
  }
  const scenePlace = scene?.place ?? ''
  const present = Array.isArray(scene?.present) ? scene.present.join(' ') : ''
  // The model derives a query from director notes and the current request.
  // Old transcript mentions never keep a database entry permanently active.
  const originalHay = `${userText} ${scenePlace} ${present}`
  const hay = originalHay.toLowerCase()
  const requests = [], requestIds = new Map()
  for (const e of entries) {
    if (!e.tavern?.useRegex) continue
    const indices = []
    for (const key of [...(e.keywords ?? []), ...(e.tavern.secondaryKeys ?? [])]) {
      indices.push(requests.length); requests.push(worldbookRegex(key,e.tavern.caseSensitive))
    }
    requestIds.set(e.id,indices)
  }
  const regex = await boundedRegexMatch(requests,originalHay.slice(-32768))
  const scored = []
  for (const e of entries) {
    let score = 0
    const reasons = []
    if (e.tavern) {
      const primary = e.keywords ?? [], secondary = e.tavern.secondaryKeys ?? []
      const values = e.tavern.useRegex
        ? (requestIds.get(e.id) ?? []).map(i => regex.ok && regex.matches[i] === true)
        : [...primary,...secondary].map(key => e.tavern.caseSensitive ? originalHay.includes(key) : hay.includes(key.toLowerCase()))
      const hit = values.slice(0,primary.length).some(Boolean)
        && (!e.tavern.selective || values.slice(primary.length).some(Boolean))
      if (!hit) continue
    }
    const names = e.tavern ? [] : [e.name, ...(e.aliases ?? []), ...(e.keywords ?? []), ...(e.triggers ?? [])]
    if (e.tavern) {score += 200; reasons.push('card-keys')}
    for (const n of names) {
      if (!n) continue
      if (hay.includes(String(n).toLowerCase())) {
        score += 200
        reasons.push(`命中:${n}`)
      }
    }
    if (score <= 0) continue
    const rendered = renderWorldbookEntry(e)
    scored.push({
      e,
      score,
      reasons: [...new Set(reasons)].slice(0, 4),
      // tokenBudget 是作者的上限提示，不可把任意长正文固定算成 400/500。
      budgetTokens: Math.max(estimateTokens(rendered), Number(e.tokenBudget) > 0 ? Number(e.tokenBudget) : 0),
    })
  }
  scored.sort(
    (a, b) =>
      (Number(b.e.priority) ?? 0) - (Number(a.e.priority) ?? 0) ||
      b.score - a.score
  )
  const picked = []
  let used = 0
  for (const s of scored) {
    if (used + s.budgetTokens > budgetTokens) continue
    used += s.budgetTokens
    picked.push(s)
  }
  return {
    entries: picked.map((s) => ({
      id: s.e.id,
      name: s.e.name,
      kind: s.e.kind,
      version: s.e.version,
      priority: s.e.priority,
      locked: s.e.locked === true,
      score: s.score,
      reasons: s.reasons,
    })),
    text: picked.map((s) => renderWorldbookEntry(s.e)).join('\n\n'),
    usedTokens: used,
    regexStatus: regex.ok ? 'ready' : regex.reason,
  }
}

const dependencyValue=(record,fields)=>fields ? Object.fromEntries(fields.map(field=>[field,record?.[field]??null])) : record??null
export function taskDependenciesCurrent(T,branchId,dependencies=[]) {
  return dependencies.every(d=>['cards','rules','worldbook'].includes(d.table)&&d.key.startsWith(`${branchId}__`)
    && recordSha256(dependencyValue(T[d.table].get(d.key),d.fields))===d.hash)
}
export async function buildDecisionContext(T,branchId,{narrative,userText,scene,directorNotes,memory,budgetTokens=6000}) {
  T=Object.fromEntries(['cards','rules','worldbook'].map(table=>[table,new Map([...T[table].entries()].filter(([key])=>key.startsWith(`${branchId}__`)).map(([key,value])=>[key,structuredClone(value)]))]))
  const dependencies=[]
  const read=(table,key,fields)=>{
    const value=dependencyValue(T[table].get(key),fields)
    dependencies.push({table,key,fields,hash:recordSha256(value)})
    return value
  }
  const characters=[...T.cards.keys()].filter(key=>key.startsWith(`${branchId}__`))
    .map(key=>read('cards',key,['id','name','kind','content']))
  const rules=read('rules',keyOf(branchId,'spec'),['core','plot'])
  // Search inside the owning branch before spawning. Children cannot escape
  // their frozen scope by using a parent session's arbitrary storage tools.
  const lore=await retrieveWorldbook(T,branchId,`${userText??''}\n${narrative}\n${directorNotes??memory?.summary??''}`,scene,budgetTokens)
  for(const entry of lore.entries)read('worldbook',keyOf(branchId,entry.id))
  return {dependencies,context:{userAction:userText??'',narrative,scene:scene??{},characters,
    core:rules.core,possiblePlotGuidance:rules.plot,directorNotes:directorNotes??memory?.summary??'',
    worldbook:{text:lore.text,entries:lore.entries,usedTokens:lore.usedTokens,regexStatus:lore.regexStatus}}}
}

// ── 锁定事实 / 角色卡渲染 ────────────────────────────────────────────────────

function lockedFactsOf(T, branchId) {
  const prefix = `${branchId}__`
  const facts = []
  for (const [k, v] of T.cards.entries()) {
    if (!k.startsWith(prefix) || !v) continue
    if (v.locked === true && v.content) facts.push({ source: `card:${v.id}`, text: v.content })
  }
  for (const [k, v] of T.worldbook.entries()) {
    if (!k.startsWith(prefix) || !v) continue
    if (v.enabled !== false && v.locked === true && v.content) facts.push({ source: `worldbook:${v.id}`, text: v.content })
  }
  const mem = T.memory.get(keyOf(branchId, 'head'))
  if (mem && Array.isArray(mem.lockedFacts)) {
    for (const f of mem.lockedFacts) facts.push({ source: 'memory-locked', text: typeof f === 'string' ? f : f?.text ?? '' })
  }
  return facts.filter((f) => f.text)
}

function renderCards(T, branchId) {
  const prefix = `${branchId}__`
  const parts = []
  // Storage hydration order can differ from live writes. Stable identities,
  // not Map insertion order, determine the unchanged author prompt prefix.
  for (const [k, v] of [...T.cards.entries()].filter(([key])=>key.startsWith(prefix)).sort(([a],[b])=>a<b?-1:a>b?1:0)) {
    if (!k.startsWith(prefix) || !v) continue
    const lines = []
    lines.push(`## 角色卡：${v.name ?? v.id}${v.kind === 'user' ? '（玩家角色 {{user}}）' : v.kind === 'npc' ? '（NPC）' : ''}`)
    if (v.content) lines.push(v.content)
    if (v.locked === true) lines.push('（本卡含锁定事实）')
    parts.push(lines.join('\n'))
  }
  return parts.join('\n\n')
}

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
  '字段名必须写在 label，字段内容必须写在 value；下一步文案必须写在 options[].label，禁止把这些内容写进 reason/name/content 等其他键。' +
  '规则：严格遵守状态栏设定中的字段与格式（好感度数值规则、颜文字风格、选项规则）；' +
  '若设定含 HTML 模板，按作者布局输出完整 html；保留静态 class/id、内联样式及 style/script。作者动态占位符可用双花括号或 ⟦字段⟧，两者等价，必须填入本轮真实状态值（包括 style 中的进度数值），不要逐字回抄动态占位符。{{user}} / {{user_gender}} 是保留给渲染层的玩家身份变量。' +
  '同时仍输出 fields/options 供系统拼接上下文与悬浮窗交互；选项按钮带 class="f" 的元素点击后会被填入输入框。' +
  '任何涉及主角姓名的位置（title/label/value/html）一律输出 {{user}} 或 {{user_gender}} 占位符：不要写真实名字，也不要写 user/用户 等字面量，渲染层会统一确定性替换。' +
  '只依据正文与场景中实际发生的内容填写，不编造；若设定含正则美化规则，按其意图生成。只输出 JSON。'

const DECISION_SYSTEM =
  '你是角色扮演工作台的轮末建议生成器。根据最新正文与当前场景，为玩家生成 3 个下一步行动建议：' +
  '每条 50 字以内、第三人称叙事口吻、具体可执行、互不相同（一条偏主动推进，一条偏试探互动，一条可留白或转移场景）；' +
  '可加好感的选项 heart=true。选项文案必须放在 label，禁止放进 reason/name/content。只输出 JSON：{"options":[{"label":"…","heart":false}]}，不要输出任何其他文字。'

// ── 插件主体 ────────────────────────────────────────────────────────────────

export async function apply(ctx, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...(config ?? {}) }

  // `sessions` contains only Agents currently retained by the Host. Opening a
  // persisted conversation directly into Reader after a service restart does
  // not necessarily retain its Agent first, so REST callers must use the Host
  // Session API to resume exactly the Session they address. This is activation,
  // not generation: no prompt is sent and unselected sibling branches stay cold.
  async function resolveRoleplaySession(sessionId) {
    const id = String(sessionId ?? '').trim()
    if (!id) return null
    let session = ctx.sessions.get(id)
    if (!session) {
      try {
        const found = await ctx.sessionController.resolveAgent(id)
        session = found && !('error' in found)
          ? found.agent?.session ?? ctx.sessions.get(id)
          : null
      } catch (error) {
        try {
          ctx.logger?.warn?.(`roleplay: failed to resume Session ${id}: ${String(error?.message ?? error)}`)
        } catch {}
        return null
      }
    }
    return session && isRoleplaySession(session) ? session : null
  }

  // per-session 运行时状态（standing mount 被同一 preset 的多个会话共享）
  const sessions = new Map() // sessionId -> runtime state
  // Decision cards are produced by an asynchronous worker while the browser
  // may answer (or a new turn may supersede them).  Serialize every read/
  // modify/write for one branch so a late worker can never resurrect an
  // already answered card.
  const decisionMutationLocks = new Map()

  async function withDecisionMutationLock(branchId, work) {
    const key = String(branchId)
    const prior = decisionMutationLocks.get(key) ?? Promise.resolve()
    let release
    const gate = new Promise((resolveGate) => { release = resolveGate })
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

  const taskAgents = new Map()
  const priceCatalog=createPriceCatalog({table:T.branch})
  const exchangeRates=createExchangeRates({table:T.branch})
  const telemetry = createTelemetry({table:T.branch,sessions:ctx.sessions,query:ctx.sessionQuery,
    jobs:()=>[...T.branch.entries()].filter(([key])=>key.startsWith('tavern_job__')||key.startsWith('tavern_cardjob__')||key.startsWith('tavern_novel__')).map(([,value])=>value)})
  // Observe every supported native LLM entry, including retries, regeneration,
  // auxiliary calls and child sessions. Never filter by current story surface.
  ctx.on('llm/stream', (options,next)=>telemetry.observe(options,next), {global:true})
  ctx.on('session/event', (session,event)=>{
    if(['turn/end','tool/result','compaction/end'].includes(event?.type))void telemetry.ingest(session).catch(()=>{})
  }, {global:true})
  ctx.effect(()=>{const tick=()=>{if(telemetry.prices().autoSync)priceCatalog.refresh()};tick();const timer=setInterval(tick,6*60*60*1000);timer.unref?.();return()=>clearInterval(timer)},'roleplay: automatic price catalog refresh')
  ctx.effect(()=>{const tick=()=>{if(exchangeRates.state().fetchedAt)exchangeRates.refresh()};tick();const timer=setInterval(tick,60*60*1000);timer.unref?.();return()=>clearInterval(timer)},'roleplay: daily exchange rate refresh')
  const libraries = new Map()
  const libraryFor=session=>{
    const workspace=realpathSync(session.header.cwd)
    if(!libraries.has(workspace))libraries.set(workspace,createTavernLibrary({workspace,table:T.branch}))
    return libraries.get(workspace)
  }
  const resourceName=(name,extension='.md')=>`${String(name??'角色卡').normalize('NFC').replace(/[\x00-\x1f<>:"/\\|?*]/g,'-').replace(/[. ]+$/,'').slice(0,90)||'角色卡'}${extension}`
  async function archiveImported(session,record) {
    const extension=record.sourceEnvelope?.extension??extname(record.sourceFile??'').toLowerCase()
    const bytes=record.sourceEnvelope?Buffer.from(record.sourceEnvelope.base64,'base64'):Buffer.from(record.rawSource,'utf8')
    if(sha256(bytes)!==record.rawSha256)throw new Error('入库原卡哈希不匹配')
    let name='角色卡'
    if(record.sourceEnvelope)name=decodeTavernCard(bytes,extension).data.name??name
    else name=record.assignments?.find(a=>a.target==='card')?.name??name
    if(record.resourceTitle)name=record.resourceTitle
    const migrated=await libraryFor(session).migrate({id:`import-${record.importId}`,name:resourceName(name,extension||'.md'),
      type:extension==='.png'?'image/png':extension==='.json'?'application/json':'text/markdown',bytes,
      source:{sessionId:record.sessionId??session.id,kind:'card-import',importId:record.importId,sha256:record.rawSha256}})
    if(!migrated.ok)throw new Error('角色卡入库待重试')
    return migrated.resource
  }
  async function migrateResources(session) {
    const library=libraryFor(session), workspace=realpathSync(session.header.cwd)
    for(const record of [...T.branch.values?.()??[...T.branch.entries()].map(([,v])=>v)]) {
      if(record?.importId&&record.status==='active'&&record.workspaceRoot===workspace)try{await archiveImported(session,record)}catch{}
      if(record?.exportId&&record.status==='completed'&&typeof record.file==='string'&&isPathWithin(workspace,resolve(record.file))) {
        await library.migrate({id:`export-${record.exportId}`,name:resourceName(record.title??'角色卡'),type:'text/markdown',path:record.file,
          source:{sessionId:record.branchId??session.id,kind:'card-export',exportId:record.exportId,sha256:record.resultHash}})
      }
    }
    return library
  }
  const sameModelRoute=(a,b)=>Boolean(a?.provider&&a?.model&&a.provider===b?.provider&&a.model===b?.model)
  const canonicalModelRoute=async selection=>{if(!ctx.llm?.resolveModelInfo)return selection
    const info=await ctx.llm.resolveModelInfo(selection.provider,selection.model)
    return {...selection,provider:info.provider,model:info.id}
  }
  const executedMainRoute=(session,agent)=>canonicalModelRoute(selectedMainRoute({events:eventsOf(session).filter(e=>e.type==='request/header')},agent,ctx.agentDefaultModel.currentSelection()))
  const modelPolicy = createModelPolicy({table:T.branch,
    session:id=>ctx.sessions.get(id),
    legacy:config.workerProvider && config.workerModel ? {provider:config.workerProvider,model:config.workerModel} : null,
    main:(session,agent)=>selectedMainRoute(session,agent??taskAgents.get(session.id),ctx.agentDefaultModel.currentSelection()),
    canonicalize:canonicalModelRoute,
  })
  const taskStory = session => {
    const entries=ctx.get('compaction')?.storyEvidence?.(session)??[]
    return [...new Map([...entries,...surfaceEntries(session)].map(e=>[e.seq,e])).values()]
  }
  const characterCluster=createCharacterCluster({table:T.branch,subagents:ctx.subagents,
    rootOf:session=>ctx.get('tavernConversations')?.rootOf(session.id)??session.id,
    main:(session,agent)=>selectedMainRoute(session,agent,ctx.agentDefaultModel.currentSelection()),
    isCurrent:(session,job)=>storyBranchIsActive(session)
      && Number(eventsOf(session).findLast(e=>e.type==='turn/start')?.data?.turn)===Number(job.source.turn)
      && (!job.input?.character || T.cards.get(keyOf(session.id,job.input.character.id))?.content===job.input.character.content),
  })
  const characterRoster=session=>[...T.cards.entries()].filter(([key,c])=>key.startsWith(`${session.id}__`)&&c?.kind!=='user'&&c?.id!=='user'&&c?.enabled!==false)
    .map(([,c])=>({id:c.id,name:c.name??c.id,content:c.content??''}))
  const clusterLoreVisible=(session,record,before=Infinity)=>record.schemaVersion===1&&surfaceEvents(session).some(e=>e.type==='tool/result'&&e.seq<before&&!e.data?.error
    && record.callId&&(e.data?.message?.source?.callId??e.data?.callId)===record.callId)
  const clusterPhase=session=>{
    for(const e of [...eventsOf(session)].reverse()){
      if(e.type==='turn/start'||e.type==='turn/end')return null
      if(e.type==='user/message'&&e.data?.source?.plugin==='roleplay-tasks'&&e.data.source.form==='phase')return e.data.source
    }
    return null
  }
  const clusterJob=agent=>{
    if(!(Number(agent?.options?.subagentDepth)>0)&&agent?.session?.header?.origin!=='subagent')return null
    const descriptor=eventsOf(agent.session).findLast(e=>e.type==='subagent/descriptor'&&e.seq>=Number(agent.session.header?.seedLength??0))
    const id=agent.options?.tavernTaskId??/^Tavern:([a-f0-9]{64}):/.exec(descriptor?.data?.label??'')?.[1]
    const job=id?T.branch.get(`tavern_job__${id}`):null
    return job?.kind==='character'?job:null
  }
  const tavernTasks = createTavernTasks({table:T.branch,policy:modelPolicy,subagents:ctx.subagents,
    isCurrent:(session,job)=>{
      if(!storyBranchIsActive(session))return false
      if(job.source.preparationId && T.branch.get(keyOf(session.id,'task-preparation'))?.id!==job.source.preparationId)return false
      const hash=job.source.hashKind==='taskHash'?value=>recordSha256(value):sha256
      const live=new Map(taskStory(session).map(e=>[e.seq,hash(e.text)]))
      if(job.source.workflowId) {
        const workflow=T.branch.get(`${job.source.workflowType==='card'?'tavern_cardjob__':'tavern_novel__'}${job.source.workflowId}`)
        if(!workflow||workflow.generation!==job.source.generation||['cancelled','stale'].includes(workflow.status))return false
      }
      return (job.source.events??[]).every(e=>live.get(e.seq)===e.hash)
        && (!job.source.fixedHash || job.source.fixedHash===recordSha256(statusFixedContext(session)))
        && taskDependenciesCurrent(T,session.id,job.source.dependencies)
    },
  })
  async function nativeTask({session,agent,system,user,format='json',kind,signal,timeoutMs,maxTokens,validate,source:providedSource,selection,generationKey,tools:allowedTools,taskStage,background=false,onResult,onAdmission}) {
    if(!session)throw new Error('酒馆任务缺少所属会话')
    if(!agent&&!taskAgents.has(session.id)) {
      const found=await ctx.sessionController.resolveAgent?.(session.id)
      if(found?.agent)agent=found.agent
    }
    if(agent)taskAgents.set(session.id,agent)
    kind=kind??(system===STATUS_SYSTEM?'status':system===DECISION_SYSTEM?'decision':system===ORGANIZE_WORKER_SYSTEM?'novel-export':'memory')
    const preparation=T.branch.get(keyOf(session.id,'task-preparation'))
    const source=providedSource??{events:taskStory(session).map(e=>({seq:e.seq,hash:sha256(e.text)})),...(kind==='status'?{fixedHash:recordSha256(statusFixedContext(session))}:{}),
      ...(!background&&preparation?.sessionId===session.id&&preparation.status==='preparing'?{preparationId:preparation.id}:{})}
    // Nonces protect prompt boundaries, but are not a changing task input.
    const requestKey={system,user:String(user).replace(/(<\/?rp-content:)[0-9a-f]{36}(>)/g,'$1NONCE$2'),generationKey}
    try {return await tavernTasks.request({session,agent:agent??taskAgents.get(session.id),kind,source,input:{system,user,format,taskStage},requestKey,format,signal,timeoutMs,maxTokens,selection,background,tools:allowedTools,onResult,onAdmission,
      validate:validate??(value=>{
        if(format==='text'){if(typeof value!=='string'||!value.trim())throw new Error('任务文本为空');return value}
        if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('任务需要 JSON 对象')
        return value
      }),
    })}catch(error){
      if(isInlinePending(error)&&kind==='memory'&&format==='text')await T.branch.put(keyOf(session.id,'task-memory-resume'),{schemaVersion:1,sessionId:session.id,status:'pending',taskStage:taskStage??'notes',source:{taskId:error.jobId},updatedAt:Date.now()})
      const main=agent??taskAgents.get(session.id)
      if(isInlinePending(error)&&!signal?.aborted&&main?.status==='idle'&&typeof main.steer==='function') {
        const timer=setTimeout(()=>{if(!signal?.aborted&&main.status==='idle'&&tavernTasks.pending(session).length)main.steer(taskPhaseMessage('management',taskInstruction(session)))},0);timer.unref?.()
      }
      throw error
    }
  }
  async function resumeMemoryWork(session,agent,signal) {
    const key=keyOf(session.id,'task-memory-resume'),record=T.branch.get(key)
    if(record?.sessionId!==session.id||record.status!=='pending')return
    const engine=ctx.get('compaction')
    if(typeof engine?.resumeTask!=='function')return
    await engine.resumeTask(agent,signal,record.taskStage)
    await T.branch.put(key,{...record,status:'completed',completedAt:Date.now()})
    const maintenance=maintenanceJobs.get(session.id)
    if(maintenance?.kind==='notes'&&maintenance.state!=='completed'){maintenance.state='completed';maintenance.error=null;maintenance.finishedAt=Date.now()}
  }
  async function resumeStatusMaintenance(session,agent) {
    const job=maintenanceJobs.get(session.id)
    if(job?.kind!=='status-rebuild'||job.state!=='waiting-main')return
    const event=eventsOf(session).find(e=>e.seq===job.atSeq)
    const result=await runStatusObligation(session,event,'maintenance-resume',{agent})
    if(result?.state==='waiting-main')throw Object.assign(new Error('状态生成等待主循环'),{code:'TAVERN_INLINE_PENDING'})
    if(result?.state==='completed'&&result.publicationState==='published'){job.state='completed';job.error=null;job.finishedAt=Date.now()}
    else {job.state='failed';job.error='状态结果尚未发布，可重试'}
  }
  const novelExports=createNovelExports({table:T.branch,history:session=>{
    const engine=ctx.get('compaction')
    if(typeof engine?.storyEvidence!=='function')throw new Error('完整剧情历史服务尚未就绪，请稍后重试导出')
    return engine.storyEvidence(session)
  },request:nativeTask,
    archive:async(session,job,markdown)=>{
      const lib=libraryFor(session),resource=await lib.archive({name:resourceName(job.plan.title),type:'text/markdown',bytes:Buffer.from(markdown,'utf8'),source:{sessionId:session.id,kind:'novel-export',jobId:job.id,sourceHash:job.sourceHash}})
      return lib.metadata(resource.id)
    },
  })
  async function resumeNovelExports(session,agent,signal) {
    for(const job of novelExports.list(session).filter(j=>['queued','running','waiting-main'].includes(j.status)))await novelExports.drive(session,job.id,agent,signal)
  }
  const cardWorkflowKey=id=>`tavern_cardjob__${id}`
  const cardWorkflows=session=>[...T.branch.entries()].filter(([k,j])=>k.startsWith('tavern_cardjob__')&&j.sessionId===session.id).map(([,j])=>cloneRecord(j))
  const activeCardWorkflow=session=>cardWorkflows(session).find(j=>['queued','running','waiting-main'].includes(j.status))
  function assertCardWorkflow(session,record) {
    if(!record?.workflowId)return
    const job=T.branch.get(cardWorkflowKey(record.workflowId))
    if(!job||job.sessionId!==session.id||['cancelled','stale','failed'].includes(job.status)||record.workflowGeneration!==job.generation||!storyBranchIsActive(session))throw new Error('角色卡任务授权已取消或来源已失效')
    if(job.kind==='card-import'&&record.rawSha256!==job.source.sha256)throw new Error('角色卡任务来源哈希不匹配')
  }
  async function beginCardWorkflow(session,kind,sourceFile,agent) {
    if(!['card-import','card-export'].includes(kind))throw new Error('角色卡任务类型无效')
    const active=activeCardWorkflow(session)
    if(active&&active.kind!==kind)throw new Error('当前会话已有另一项角色卡任务，请先完成或取消')
    const source=kind==='card-import'?readCardSource(session.header.cwd,sourceFile):null
    if(active){if(source&&active.source.sha256!==sha256(source.bytes))throw new Error('当前会话正在读取另一张卡，请先完成或取消');return active}
    const id=randomUUID(),selection=await modelPolicy.resolve(session,kind,agent)
    const job={schemaVersion:1,id,kind,sessionId:session.id,branchId:session.id,generation:randomUUID(),selection,execution:selection.execution,actualRoute:selection.actualRoute,
      status:'queued',createdAt:Date.now(),progress:{done:0,total:1},source:{sourceFile:source?.sourcePath??null,sha256:source?sha256(source.bytes):recordSha256(statusFixedContext(session))}}
    await T.branch.put(cardWorkflowKey(id),job)
    return job
  }
  async function resumeCardWorkflows(session,agent,signal) {
    const job=activeCardWorkflow(session)
    if(!job)return
    const source={workflowId:job.id,workflowType:'card',generation:job.generation,events:[]}
    try {
      await T.branch.put(cardWorkflowKey(job.id),{...job,status:'running'})
      const result=await nativeTask({session,agent,kind:job.kind,format:'workflow',selection:job.selection,source,signal,timeoutMs:600000,
        tools:job.kind==='card-import'?['rp_card_import_begin','rp_card_import_chunk','rp_card_import_stage','rp_card_import_finalize']:['rp_card_export_begin','rp_card_export_chunk','rp_card_export_finalize'],
        system:job.kind==='card-import'
          ?'使用原生读卡工具完成完整导入：rp_card_import_begin → 连续rp_card_import_chunk全文审阅 → rp_card_import_stage完整分类 → rp_card_import_finalize激活。所有设定和附加字段完整保留。只处理任务指定文件，失败不能绕过或改源文件，不续写剧情。已存在当前任务的导入记录时续做该记录，不重新开始。完成后提交任务结果。\n'+CARD_CLASSIFICATION_GUIDE
          :'使用原生逆向组卡：rp_card_export_begin冻结当前最新已编辑设定 → rp_card_export_chunk连续全文审阅 → rp_card_export_finalize组织完整MD并落盘。按创作语义重组，用户新增镜头语言归入叙事规则，不照搬来源字段。混合来源全文审阅后用chunk(source_id)取得行号，再用sections.source_parts拆分，每行完整恰好一次。深度组织章节、不精简，不用旧原卡覆盖编辑。已有本任务导出记录时从检查点续做，不重新开始。完成后提交任务结果。\n'+CARD_CLASSIFICATION_GUIDE,
        user:JSON.stringify({jobId:job.id,...job.source}),
        validate:async()=>{
          const records=[...T.branch.entries()].map(([,v])=>v).filter(v=>v?.workflowId===job.id)
          const completed=records.find(v=>job.kind==='card-import'?v.status==='active'&&v.rawSha256===job.source.sha256:v.status==='completed'&&v.exportId)
          if(!completed)throw new Error('角色卡任务还没有可核验的完整结果，请继续原生工具流程')
          if(job.kind==='card-import') {
            const resource=await archiveImported(session,completed)
            return {importId:completed.importId,resourceId:resource?.id??resource?.resourceId}
          }
          const lib=libraryFor(session),resource=await lib.migrate({id:`export-${completed.exportId}`,name:resourceName(completed.title??'角色卡'),type:'text/markdown',path:completed.file,source:{sessionId:session.id,kind:'card-export',exportId:completed.exportId}})
          if(!resource.ok)throw new Error('角色卡导出入库待重试')
          return {exportId:completed.exportId,file:completed.file,resourceId:resource.resource.id}
        },
      })
      const live=T.branch.get(cardWorkflowKey(job.id))
      if(live?.generation===job.generation&&live.status!=='cancelled')await T.branch.put(cardWorkflowKey(job.id),{...live,status:'completed',result,resourceId:result.resourceId,progress:{done:1,total:1},completedAt:Date.now()})
    }catch(error){
      const live=T.branch.get(cardWorkflowKey(job.id))
      if(live?.generation===job.generation&&live.status!=='cancelled')await T.branch.put(cardWorkflowKey(job.id),{...live,status:isInlinePending(error)?'waiting-main':'failed',error:isInlinePending(error)?null:String(error.message)})
      if(isInlinePending(error))throw error
    }
  }
  async function completeCardWorkflow(session,record,result) {
    if(!record.workflowId)return
    const job=T.branch.get(cardWorkflowKey(record.workflowId))
    if(!job||job.sessionId!==session.id||['cancelled','stale','failed'].includes(job.status))throw new Error('角色卡任务已失效')
    if(job.kind==='card-import'?(!record.importId||record.status!=='active'||record.rawSha256!==job.source.sha256):!record.exportId)throw new Error('角色卡任务与完成结果不匹配')
    if(!result.resourceId){await T.branch.put(cardWorkflowKey(job.id),{...job,status:'failed',error:'设定已保存，资源入库待重试'});return}
    for(const task of tavernTasks.pending(session).filter(t=>t.source?.workflowId===job.id)) {
      try {await tavernTasks.submit({session,id:task.id,generation:task.generation,value:{finished:true}})}catch{}
    }
    await T.branch.put(cardWorkflowKey(job.id),{...job,status:'completed',result,resourceId:result.resourceId,progress:{done:1,total:1},completedAt:Date.now()})
    if(job.kind==='card-import'&&!job.openingRequested) {
      const opening=T.opening.get(keyOf(session.id,'scene'))?.text
      if(opening) {
        const main=taskAgents.get(session.id)??(await ctx.sessionController.resolveAgent?.(session.id))?.agent
        if(typeof main?.steer==='function') {
          main.steer(taskPhaseMessage('story',`角色卡已完整读入并激活。现在完整展示作者原始开场，不附导入回执、不改写、不提前续写：\n${fenceCardContent(opening,'opening')}`,{openingImportId:record.importId}))
          await T.branch.put(cardWorkflowKey(job.id),{...T.branch.get(cardWorkflowKey(job.id)),openingRequested:true})
        }
      }
    }
  }

  const contextWindowKey = (branchId) => keyOf(branchId, 'context-window')
  const contextWindowFor = (session) => T.branch.get(contextWindowKey(session.id)) ?? {
    windowNumber: 1,
    windowId: randomUUID(),
    previousWindowId: null,
    branchId: session.id,
    startSeq: -1,
    throughSeq: -1,
    storyTokens: 0,
    createdAt: Date.now(),
    rolloverCount: 0,
  }
  const cloneContextWindow = (record) => record && typeof record === 'object'
    ? structuredClone(record)
    : null
  const ensureContextWindow = async (session, reason = 'initial') => {
    const key = contextWindowKey(session.id)
    const current = T.branch.get(key)
    if (current) return current
    const initial = { ...contextWindowFor(session), reason }
    await T.branch.put(key, initial)
    return initial
  }
  const rolloverContextWindow = async (session, metadata = {}, options = {}) => {
    const previous = await ensureContextWindow(session, 'initial')
    const next = {
      windowNumber: Number(previous.windowNumber || 1) + 1,
      windowId: randomUUID(),
      previousWindowId: previous.windowId ?? null,
      branchId: session.id,
      startSeq: Number.isSafeInteger(Number(metadata.startSeq)) ? Number(metadata.startSeq) : lastSeq(session),
      throughSeq: lastSeq(session),
      createdAt: Date.now(),
      rolloverCount: Number(previous.rolloverCount || 0) + 1,
      ...metadata,
    }
    // Callers that still need to write the surface checkpoint can request a
    // draft first.  Publishing the boundary before the checkpoint would leave
    // a half-created model window if append/replace fails midway through a
    // rollover.
    if (options.persist !== false) await T.branch.put(contextWindowKey(session.id), next)
    return cloneContextWindow(next)
  }

  const visibleStorySurfaceSeqs = (session) => {
    const internal = internalTaskSeqs(session)
    return surfaceEvents(session)
    .filter((event) => (event.type === 'user/message' && event.data?.source?.kind === 'user')
      || (event.type === 'assistant/message' && !internal.has(Number(event.seq))
        && textOf(event.data?.message?.content).trim()
        && !(event.data?.message?.content ?? []).some((block) => block?.type === 'tool-call' || block?.type === 'tool-result')))
    .map((event) => Number(event.seq))
  }

  async function installRoleplayWindowCheckpoint(session, previousWindow, activeWindow, continuityTailTokens, agent, signal) {
    if (!session?.append || !previousWindow || !activeWindow || previousWindow.windowId === activeWindow.windowId) return null
    const surface = surfaceEvents(session)
    const storySeqs = visibleStorySurfaceSeqs(session)
    if (storySeqs.length < 2) return null
    const tail = []
    let used = 0
    for (let index = storySeqs.length - 1; index >= 0; index -= 1) {
      const event = eventsOf(session)[storySeqs[index]]
      const text = event?.type === 'assistant/message' ? textOf(event.data?.message?.content) : textOf(event?.data?.content)
      const cost = estimateTokens(text)
      if (tail.length && used + cost > continuityTailTokens) break
      tail.unshift(storySeqs[index])
      used += cost
    }
    const cutStory = storySeqs.filter((seq) => !tail.includes(seq))
    if (!cutStory.length) return null
    const anchor = cutStory[0]
    const end = cutStory.at(-1)
    const firstStoryIndex = surface.findIndex((event) => Number(event.seq) === anchor)
    if (firstStoryIndex < 0) return null
    const startIndex = roleplayWindowCutStartIndex(surface, firstStoryIndex)
    const endIndex = surface.findIndex((event) => Number(event.seq) === end)
    if (startIndex < 0 || endIndex < startIndex) return null
    // Surface replacement provenance must cover every node in the contiguous
    // range, including tool results and hidden plugin context nodes.
    const cut = surface.slice(startIndex, endIndex + 1).map((event) => Number(event.seq))
    const sourceFingerprint = recordSha256(surface.map(event => ({ seq:event.seq, type:event.type, data:event.data })))
    const proof = await ctx.get('compaction')?.ensureWindowCheckpoint?.(agent, signal)
    if (proof?.status !== 'ready' || proof.branchId !== session.id || !Array.isArray(proof.sourceKeys)) {
      throw new Error('窗口检查点尚未保存，保留当前窗口；请重试')
    }
    signal?.throwIfAborted?.()
    assertStoryBranchActive(session)
    if (sourceFingerprint !== recordSha256(surfaceEvents(session).map(event => ({ seq:event.seq, type:event.type, data:event.data })))) {
      throw new Error('保存期间窗口来源已变化，保留当前窗口；请重试')
    }
    const checkpoint = session.append('user/message', {
      id: randomUUID(),
      role: 'user',
      content: [{ type: 'text', text: `[角色扮演上下文窗口 ${activeWindow.windowNumber}] 旧剧情已保存在只读历史。当前窗口保留最新 ${continuityTailTokens} tokens 的完整正文；需要旧事实时调用 rp_history。` }],
      source: { kind: 'plugin', plugin: 'roleplay-context-window', form: 'snapshot', schemaVersion: 1,
        checkpointGeneration: proof.generationId, checkpointSourceKeys: proof.sourceKeys,
        checkpointSourceSeqs: proof.sourceSeqs },
    }, {
      surfaceOp: { op: 'replace', start: cut[0], end },
      sourceEventSeqs: [...cut],
    })
    return { checkpointSeq: checkpoint.seq, shadowedSeqs: cut, tailSeqs: tail, usedTokens: used }
  }

  // storage-domain get() returns an immutable logical snapshot.  Always clone
  // before preparing a changed record so a failed put cannot leak mutations.
  const cloneBranchRecord = (value) => value == null ? value : structuredClone(value)

  // The model and older roleplay records use several aliases for the same
  // status-bar fields. Normalize at the boundary so storage, workers, and UI
  // all see one stable shape without rewriting historical records in place.
  const textAlias = (object, keys) => {
    const source = object && typeof object === 'object' ? object : {}
    for (const key of keys) {
      const value = source[key]
      if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
    }
    return ''
  }
  const normalizeStatusField = (field) => {
    const source = field && typeof field === 'object' ? field : {}
    return {
      ...source,
      emoji: textAlias(source, ['emoji', 'icon']),
      // Gemini 3.7 may encode a field as { reason: "字段名" }.
      // Options have their own normalizer, where reason means option text.
      label: textAlias(source, ['label', 'name', 'title', 'key', 'reason']),
      value: textAlias(source, ['value', 'text', 'content', 'description', 'detail']),
    }
  }
  const normalizeStatusOption = (option) => {
    const source = option && typeof option === 'object' ? option : {}
    return {
      ...source,
      label: textAlias(source, ['label', 'text', 'value', 'reason', 'content', 'name', 'title']),
      description: textAlias(source, ['description', 'detail', 'desc']),
      heart: source.heart === true,
    }
  }
  const escapeStatusHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
  const fallbackStatusHtml = (source, title, fields, options, rawText) => {
    const items = fields.map((field) => {
      const label = escapeStatusHtml(field.label)
      const value = escapeStatusHtml(field.value)
      const emoji = escapeStatusHtml(field.emoji)
      return `<li style="margin:6px 0">${emoji ? `${emoji} ` : ''}<strong>${label}</strong>${label ? '：' : ''}${value}</li>`
    }).join('')
    const optionItems = options.map((option) =>
      `<li style="margin:6px 0;padding:5px 8px;border:1px solid rgba(52,152,219,.24);border-radius:8px;background:rgba(255,255,255,.48)">${option.heart ? '❤️ ' : ''}${escapeStatusHtml(option.label)}</li>`
    ).join('')
    const body = items || (rawText ? `<li style="margin:6px 0">${escapeStatusHtml(rawText)}</li>` : '')
    return `<div style="display:block;border:3px solid rgba(52,152,219,.72);border-radius:15px;background:rgba(234,236,238,.86);width:100%;min-height:180px;max-height:330px;margin:0 auto;color:#D87093;font:750 16px system-ui;overflow-y:auto;box-sizing:border-box;padding:10px 12px"><h3 style="text-align:center;font-size:18px;margin:2px 0 8px">${escapeStatusHtml(title || '状态栏')}</h3><ul style="list-style:none;padding:0 5px;margin:0;line-height:1.5">${body}${optionItems ? `<li style="list-style:none;margin-top:10px;padding-top:8px;border-top:1px solid rgba(52,152,219,.25)"><strong>下一步</strong></li>${optionItems}` : ''}</ul></div>`
  }
  const normalizeStatusPanel = (panel) => {
    const source = panel && typeof panel === 'object' ? panel : {}
    const title = textAlias(source, ['title', 'name'])
    const fields = Array.isArray(source.fields) ? source.fields.map(normalizeStatusField) : []
    const options = Array.isArray(source.options)
      ? source.options.map(normalizeStatusOption).filter((option) => option.label).slice(0, 4)
      : []
    const rawText = textAlias(source, ['rawText', 'text', 'content'])
    return {
      ...source,
      title,
      html: typeof source.html === 'string' && source.html.trim()
        ? source.html
        : fallbackStatusHtml(source, title, fields, options, rawText),
      fields,
      options,
      rawText,
    }
  }
  const authoredStatusTemplate = (spec) => {
    const template = String(spec?.templateHtml || (/<\/?[a-z][^>]*>/i.test(spec?.text ?? '') ? spec.text : '')).trim()
    if (!template) return ''
    // A style fragment alone (or a truncated style/script block) is damaged,
    // not an author layout. Prose instructions are not HTML templates.
    for (const tag of ['style', 'script']) {
      if ((template.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length !==
        (template.match(new RegExp(`</${tag}\\s*>`, 'gi')) ?? []).length) return ''
    }
    const body = template.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    return /<(?:div|section|article|aside|table|details|ul|ol|p|span|h[1-6])\b[^>]*>[\s\S]*<\//i.test(body) ? template : ''
  }

  const statusPanelForSpec = (raw, spec, {strict=false}={}) => {
    const reject=(path,rule,expected,actual)=>{
      if(strict)throw new TaskValidationError(`状态结果没有保留作者模板：${path} (${rule})`,
        [{path,rule,expected,actual}],'STATUS_TEMPLATE_MISMATCH')
      return null
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return reject('result','object-required','object',Array.isArray(raw)?'array':typeof raw)
    const template = authoredStatusTemplate(spec)
    let html = typeof raw.html === 'string' ? raw.html : ''
    if (template) {
      // A fields-only response must retry instead of silently selecting the
      // generic theme. Preserve author CSS/JS and structural hooks exactly.
      if (!authoredStatusTemplate({ templateHtml: html })) return reject('html','html-required','complete-author-html',html.trim()?'incomplete-html':'missing-html')
      const staticBlock = /<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi
      const blocks = template.match(staticBlock) ?? []
      const body = html.replace(staticBlock, '')
      const attributes = source => [...source.matchAll(/\b(style|class|id)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)]
        .map(([,name,double,single])=>({name:name.toLowerCase(),value:double??single}))
      const actual=attributes(body)
      const canonical=value=>value.replace(/⟦([^⟦⟧]+)⟧/g,'{{$1}}')
      const matches=(expected,candidate)=>{
        if(expected.name!==candidate.name)return false
        const wanted=canonical(expected.value),got=canonical(candidate.value)
        if(wanted===got)return true
        // Only explicit author slots vary. A slot cannot swallow a new CSS
        // declaration or HTML attribute; static hooks remain protected.
        const slots=[...wanted.matchAll(/\{\{(?!(?:user|user_gender|char)\}\})([^{}]+)\}\}/g)]
        let offset=0,position=0
        for(let index=0;index<slots.length;index++) {
          const slot=slots[index],prefix=wanted.slice(offset,slot.index)
          if(!got.startsWith(prefix,position))return false
          position+=prefix.length
          const end=slot.index+slot[0].length,next=wanted.slice(end,slots[index+1]?.index??wanted.length)
          if(got.startsWith(slot[0],position))position+=slot[0].length
          else {
            // Linear matching avoids constructing backtracking patterns from
            // untrusted author templates. Adjacent dynamic slots share a value.
            const boundary=next?got.indexOf(next,position):got.length
            if(boundary<position||!/^[^;"'<>={}]*$/.test(got.slice(position,boundary)))return false
            position=boundary
          }
          offset=end
        }
        return got.slice(position)===wanted.slice(offset)
      }
      const expected=attributes(template.replace(staticBlock,''))
      for(let index=0;index<expected.length;index++)if(!actual.some(candidate=>matches(expected[index],candidate)))
        return reject(`html.attributes[${index}].${expected[index].name}`,'author-static-attribute','author-value-with-dynamic-slots','missing-or-changed')
      // Keep exact author CSS/JS in code, not a paid model copying exercise.
      const remaining = [...blocks]
      html = html.replace(staticBlock, (_block, tag) => {
        const index = remaining.findIndex(block => new RegExp(`^<${tag}\\b`,'i').test(block))
        return index < 0 ? '' : remaining.splice(index,1)[0]
      })
      html = remaining.filter(block => /^<style\b/i.test(block)).join('') + html
        + remaining.filter(block => /^<script\b/i.test(block)).join('')
    }
    const normalized = normalizeStatusPanel({...raw,html})
    if (!html.trim() && !normalized.rawText && !normalized.fields.some(field => field.label || field.value)) return null
    return { ...normalized, ...(template ? { templateHtml: template } : {}) }
  }

  // Status owns a separate turn-end transaction. Neither Phase-A snapshots nor
  // memory/continuity worker success are prerequisites for this obligation.
  const statusJobs = new Map()
  const statusLocks = new Map()
  const statusRetryTimers = new Map()
  const statusRetryCounts = new Map()
  const statusRunStartSeq = new Map()
  const statusRecoveredSessions = new Set()
  let statusDisposed = false
  ctx.effect(() => () => {
    statusDisposed = true
    for (const timer of statusRetryTimers.values()) clearTimeout(timer)
    statusRetryTimers.clear()
  }, 'roleplay: status retry cleanup')
  const withStatusLock = async (branchId, fn) => {
    const prior = statusLocks.get(branchId) ?? Promise.resolve()
    const current = prior.catch(() => {}).then(fn)
    statusLocks.set(branchId, current)
    try { return await current } finally { if (statusLocks.get(branchId) === current) statusLocks.delete(branchId) }
  }
  const statusTaskKey = (session, event) => keyOf(session.id, `turn-${Number(event.data.turn)}-${Number(event.seq)}`)
  const statusSource = (session, event) => {
    if (!storyBranchIsActive(session)) return null
    if (!event || canonicalAssistantForTurn(session, event.data?.turn)?.seq !== event.seq) return null
    const start = eventsOf(session).findLast(item => item.type === 'turn/start' &&
      Number(item.data?.turn) === Number(event.data.turn) && item.seq < event.seq)
    if (!start) return null
    const user = surfaceEntries(session).filter(entry => entry.kind === 'user' && entry.seq > start.seq && entry.seq < event.seq).at(-1)
    if (!user) return null
    return {
      branchId: session.id, turnId: Number(event.data.turn), assistantSeq: Number(event.seq),
      sourceSeqs: [Number(user.seq), Number(event.seq)],
      sourceHash: recordSha256({ user: user.text, narrative: textOf(event.data.message?.content) }),
    }
  }
  const statusSourceLive = (session, event, source) =>
    !statusDisposed && recordSha256(statusSource(session, event)) === recordSha256(source)
  const selectedStatusRecord = (session) => {
    const record = normalizeStatusRecord(T.status.get(keyOf(session.id, 'panel')))
    if (!record?.provenance) return record
    const event = eventsOf(session).find(item => item.seq === record.atSeq)
    const source = statusSource(session, event)
    if (!source || record.sessionId !== session.id || record.stale ||
      source.sourceHash !== record.provenance.sourceHash ||
      recordSha256(source.sourceSeqs) !== recordSha256(record.provenance.sourceSeqs)) return null
    return record
  }
  const latestStatusEvent = session => {
    for (const entry of surfaceEntries(session).reverse()) {
      if (entry.kind !== 'assistant') continue
      const event = canonicalAssistantForTurn(session, entry.turn)
      if (event) return event
    }
    return null
  }
  const selectedStatusGeneration = session => {
    const event = latestStatusEvent(session)
    const record = event ? cloneBranchRecord(T.status.get(statusTaskKey(session, event))) : null
    if (record && !statusSourceLive(session, event, record.source)) return { ...record, state: 'stale', result: null }
    return record ?? null
  }

  const statusFixedContext = session => {
    const prefix = `${session.id}__`
    const entries = table => [...table.entries()].filter(([key, value]) => key.startsWith(prefix) && value)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, record: cloneBranchRecord(value) }))
    // Fixed author rules are not plot compression candidates. Accounting and
    // conditional route rules can live in any imported module, not only spec.
    return { cards: entries(T.cards), worldbook: entries(T.worldbook),
      rules: cloneBranchRecord(T.rules.get(keyOf(session.id, 'spec'))) ?? null }
  }

  // Keep provenance in the durable hash above. Source archives can contain a
  // second copy of the entire card; generation only needs the saved author
  // fields. Strip storage metadata at record level, never inside author data.
  const statusAuthorRecord = record => record && Object.fromEntries(Object.entries(record).filter(([key]) =>
    !['sources','source','editedFrom','schemaVersion','importId','sourceRecordSessionId','sessionId','branchId','atSeq','updatedAt','createdAt','verified'].includes(key)))
  const statusAuthorContext = fixed => ({
    // Legacy free-form personas can contain inventory/condition rules in any
    // language. Keep them until explicit status-rule provenance can replace
    // them; guessing with keywords silently drops custom resources.
    cards: fixed.cards.map(({key,record}) => ({key,record:statusAuthorRecord(record)})),
    worldbook: fixed.worldbook.filter(e=>e.record.enabled!==false&&e.record.alwaysOn===true).map(({key,record})=>({key,record:statusAuthorRecord(record)})),
    coreRules: fixed.rules?.core ?? null,
  })

  const statusStoryContext = (session, event, specHash, fixedContextHash, inputBasis) => {
    const history = (ctx.get('compaction')?.storyEvidence?.(session) ?? surfaceEntries(session))
      .map(entry => ({ seq: entry.seq, role: entry.role ?? entry.kind, text: entry.text }))
    const end = history.findIndex(entry => entry.seq === event.seq && entry.role === 'assistant')
    if (end < 0) throw new Error('当前状态缺少已选分支剧情来源，不能按初始模板重置')
    const selected = history.slice(0, end + 1)
    const selectedHistoryHash = recordSha256(selected)
    if (inputBasis?.selectedHistoryHash === selectedHistoryHash) {
      const priorIndex = inputBasis.previousStatusSource
        ? selected.findIndex(entry => entry.seq === inputBasis.previousStatusSource.assistantSeq && entry.role === 'assistant') : -1
      if (!inputBasis.previousStatusSource || priorIndex >= 0 && priorIndex < end) return {
        ...cloneBranchRecord(inputBasis), selectedStorySinceStatus:selected.slice(priorIndex + 1),
      }
    }
    let prior = null, priorSource = null, priorIndex = -1
    for (const [key, stored] of T.status.entries()) {
      if (!key.startsWith(`${session.id}__`)) continue
      const candidate = stored?.state === 'completed' ? stored.result : stored
      if (!candidate?.panel || !candidate.provenance || candidate.stale || candidate.sessionId !== session.id) continue
      const index = selected.findIndex(entry => entry.seq === candidate.atSeq && entry.role === 'assistant')
      if (index <= priorIndex || index >= end) continue
      const prefix = selected.slice(0, index + 1)
      const prefixHash = recordSha256(prefix)
      const hasHistoryHash = typeof candidate.provenance.historyHash === 'string'
      // A legacy record has no cumulative hash. Reuse it only when the entire
      // same-branch prefix still consists of original append events that were
      // already present at that checkpoint. Any later edit/replace rejects it.
      const originalPrefix = !hasHistoryHash && prefix.every(entry => entry.seq <= candidate.atSeq &&
        eventsOf(session).find(item => item.seq === entry.seq)?.surfaceOp === 'append')
      if (hasHistoryHash ? candidate.provenance.historyHash !== prefixHash : !originalPrefix) continue
      const candidateEvent = eventsOf(session).find(item => item.seq === candidate.atSeq)
      const source = statusSource(session, candidateEvent)
      if (!source || source.sourceHash !== candidate.provenance.sourceHash ||
        recordSha256(source.sourceSeqs) !== recordSha256(candidate.provenance.sourceSeqs) ||
        candidate.provenance.specHash !== specHash || candidate.provenance.fixedContextHash !== fixedContextHash) continue
      prior = cloneBranchRecord(candidate.panel)
      priorSource = { ...source, historyHash: prefixHash,
        validation: hasHistoryHash ? 'history-hash' : 'original-append-prefix' }
      priorIndex = index
    }
    return { selectedHistoryHash: recordSha256(selected), previousStatus: prior, previousStatusSource: priorSource,
      selectedStorySinceStatus: selected.slice(priorIndex + 1) }
  }

  function runStatusObligation(session, event, via = 'turn-end', { force = false, agent, signal } = {}) {
    const source = statusSource(session, event)
    if (!source || statusDisposed) return Promise.resolve(null)
    const taskKey = statusTaskKey(session, event)
    if (statusJobs.has(taskKey)) {
      const existing=statusJobs.get(taskKey)
      existing.cancellation.follow(signal)
      return existing
    }
    const cancellation=taskCancellation(signal)
    signal=cancellation.signal
    const retryTimer = statusRetryTimers.get(taskKey)
    if (retryTimer) { clearTimeout(retryTimer); statusRetryTimers.delete(taskKey) }
    let admitted
    const admission=new Promise(resolve=>{admitted=resolve})
    // Register synchronously before any await so event + idle + tool retries
    // cannot admit duplicate workers for the same canonical result.
    const job = Promise.resolve().then(async () => {
      let record = cloneBranchRecord(T.status.get(taskKey))
      let spec
      let resultCommitted = false
      try {
        await ensureBranch(session)
        spec = cloneBranchRecord(T.status.get(keyOf(session.id, 'spec')))
        if (!spec?.text || !spec.templateHtml) spec = await recoverStatusSpecFromImport(session) ?? spec
        const specHash = recordSha256(spec)
        const fixedContext = statusFixedContext(session)
        const fixedContextHash = recordSha256(fixedContext)
        const compatibleBasis = !force && record?.source?.sourceHash === source.sourceHash
          && record.specHash === specHash && record.fixedContextHash === fixedContextHash ? record.inputBasis : null
        const storyContext = statusStoryContext(session, event, specHash, fixedContextHash, compatibleBasis)
        const storyContextHash = recordSha256(storyContext)
        const input = cloneBranchRecord(T.status.get(keyOf(session.id, `input-${source.turnId}`)))
        const toolInput = input?.sessionId === session.id && input?.turnId === source.turnId &&
          input?.userSeq === source.sourceSeqs[0] &&
          input?.userHash === sha256(surfaceEntries(session).find(entry => entry.seq === input.userSeq)?.text ?? '')
          ? input : null
        const trigger = { kind: 'turn-end', id: sha256(`${session.id}:${source.turnId}:${event.seq}:${source.sourceHash}`), via }
        if (record?.state !== 'completed' || force || record.source?.sourceHash !== source.sourceHash || record.specHash !== specHash || record.fixedContextHash !== fixedContextHash || record.storyContextHash !== storyContextHash) {
          const selection=force?await modelPolicy.resolve(session,'status',agent):record?.selection??await modelPolicy.resolve(session,'status',agent)
          record = {
            schemaVersion: 1, sessionId: session.id, branchId: session.id, trigger, source, specHash, fixedContextHash, storyContextHash,
            inputBasis:{selectedHistoryHash:storyContext.selectedHistoryHash,previousStatus:storyContext.previousStatus,previousStatusSource:storyContext.previousStatusSource},
            selection,
            generationKey:force?`rebuild-${randomUUID()}`:record?.generationKey??null,
            state: 'running', attempt: (Number(record?.attempt) || 0) + 1,
            startedAt: record?.startedAt ?? Date.now(), updatedAt: Date.now(), error: null,
          }
          await T.status.put(taskKey, record)
          if (!statusSourceLive(session, event, source)) throw new Error('status source changed')
          let panel = force||!sameModelRoute(toolInput?.provenance?.actualRoute,selection.actualRoute) ? null : statusPanelForSpec(toolInput?.panel, spec)
          let inputKind = panel ? 'tool' : 'worker'
          let executionProvenance=panel?toolInput.provenance:null
          if (!panel) {
            const template = authoredStatusTemplate(spec)
            const scene = cloneBranchRecord(T.scene.get(keyOf(session.id, 'current')))
            const sceneSeq = provenanceSeq(scene)
            const selectedUserAction=surfaceEntries(session).find(entry=>entry.seq===source.sourceSeqs[0])?.text??''
            const queriedWorldbook=await retrieveWorldbook(T,session.id,`${selectedUserAction}\n${textOf(event.data.message?.content)}`,null,Number(cfg.maxWorldTokens)||6000)
            const context = {
              fixedAuthorModules: statusAuthorContext(fixedContext),
              queriedWorldbook:queriedWorldbook.text,
              ...(storyContext.selectedStorySinceStatus.some(entry=>entry.role==='user'&&entry.text===selectedUserAction)?{}:{selectedUserAction}),
              previousStatus:storyContext.previousStatus,
              previousStatusSource:storyContext.previousStatusSource,
              selectedStorySinceStatus:storyContext.selectedStorySinceStatus,
              scene: sceneSeq !== null && sceneSeq <= event.seq && (!scene.sessionId || scene.sessionId === session.id) ? scene : null,
            }
            const raw = await llmJson(ctx, resolveRoute(session, agent), {
              system: STATUS_SYSTEM,
              signal,
              onAdmission: admitted,
              selection,
              onResult:task=>{executionProvenance={taskId:task.id,generation:task.generation,actualRoute:task.actualRoute,execution:task.execution}},
              generationKey:record.generationKey??undefined,
              validate:value=>{if(!statusPanelForSpec(value,spec,{strict:true}))throw new TaskValidationError('状态结果没有可用内容',[{path:'result',rule:'nonempty-status',expected:'status-content',actual:'empty'}]);return value},
              user: `状态栏设定：\n${fenceCardContent(template && spec?.text?.trim() === template.trim() ? '设定与作者模板相同，完整内容见下方模板。' : spec?.text ?? '根据本轮正文展示已确认的位置、时间与人物状态。', 'status')}\n${template ? `\n作者原始状态栏模板（完整保留 HTML 结构、class/id、内联样式和 style/script 块；只更新动态状态值）：\n${fenceCardContent(template, 'status')}` : ''}\n\n当前分支状态依据、已提交前置状态及待结算剧情：\n${fenceCardContent(JSON.stringify(context), 'status')}\n\n以 previousStatus 为累计状态基线，按 selectedStorySinceStatus 中已经发生的剧情依次结算到本轮；最后一条 assistant 即本轮正文。基线已结算的历史不能重复扣除。没有有效基线时，根据提供的当前分支剧情从初始设定重建，不能把初始模板数值直接当成本轮值。数值与物品规则必须执行；只有剧情确实完成相应行为时才结算。不得因为本轮正文未重复数值就清空或重置累计状态。fields 与 html 必须一致。只提取状态，不续写剧情、不审阅整张角色卡。\n\n请生成状态栏 JSON。`,
              maxTokens: Math.max(6000, estimateTokens(template) * 2 + 2000), temperature: 0.4,
              timeoutMs: Number(cfg.statusWorkerTimeoutMs) || DEFAULT_CONFIG.statusWorkerTimeoutMs,
            })
            panel = statusPanelForSpec(raw, spec)
          }
          if (!panel) throw new Error('状态栏未返回可用内容或未保留作者模板；可重试')
          const templateKind = authoredStatusTemplate(spec) ? 'author' : spec?.templateHtml ? 'damaged' : 'missing'
          const result = {
            schemaVersion: 1, sessionId: session.id, branchId: session.id,
            atSeq: event.seq, turnId: source.turnId, time: Date.now(), panel,
            provenance: { triggerId: trigger.id, sourceSeqs: source.sourceSeqs, sourceHash: source.sourceHash,
              specHash, fixedContextHash, storyContextHash, historyHash: storyContext.selectedHistoryHash,
              previousStatusSource: storyContext.previousStatusSource,
              ...executionProvenance,inputKind, templateKind, toolInputSeq: toolInput?.atSeq ?? null },
          }
          await withStatusLock(session.id, async () => {
            if (!statusSourceLive(session, event, source) || recordSha256(T.status.get(keyOf(session.id, 'spec'))) !== specHash || recordSha256(statusFixedContext(session)) !== fixedContextHash || recordSha256(statusStoryContext(session, event, specHash, fixedContextHash, record.inputBasis)) !== storyContextHash) {
              throw new Error('status source changed')
            }
            record = { ...record, state: 'completed', result, publicationState: 'pending', error: null, updatedAt: Date.now() }
            await T.status.put(taskKey, record)
            resultCommitted = true
          })
        } else resultCommitted = true
        await withStatusLock(session.id, async () => {
          if (!statusSourceLive(session, event, source) || recordSha256(statusFixedContext(session)) !== fixedContextHash || recordSha256(statusStoryContext(session, event, specHash, fixedContextHash, record.inputBasis)) !== storyContextHash) throw new Error('status source changed')
          const current = selectedStatusRecord(session)
          // Later completed turns may finish their workers first. They own the
          // current projection; keep older durable results for replay only.
          const publicationState = Number(current?.atSeq ?? -1) > event.seq ? 'superseded' : 'published'
          if (publicationState === 'published' && recordSha256(current) !== recordSha256(record.result)) {
            await T.status.put(keyOf(session.id, 'panel'), record.result)
          }
          if (record.publicationState !== publicationState || record.publicationError) {
            record = { ...record, publicationState, publicationError: null }
            await T.status.put(taskKey, record)
          }
        })
        statusRetryCounts.delete(taskKey)
        return record
      } catch (error) {
        if(isInlinePending(error)) {
          await T.status.put(taskKey,{...record,state:'waiting-main',updatedAt:Date.now(),error:null})
          return cloneBranchRecord(T.status.get(taskKey))
        }
        const live = statusSourceLive(session, event, source)
        // A failed pointer write must leave the committed result available for
        // replay, including after a process restart. Do not rerun its worker.
        const durable = cloneBranchRecord(T.status.get(taskKey))
        if (!resultCommitted || durable?.state !== 'completed' || !live) {
          record = { ...(record ?? { schemaVersion: 1, sessionId: session.id, branchId: session.id,
            trigger: { kind: 'turn-end', id: sha256(`${session.id}:${source.turnId}:${event.seq}:${source.sourceHash}`), via }, source, attempt: 1 }),
            state: live ? 'retry' : 'stale', result: null,
            error: live ? '状态生成或提交失败，可重试' : '所选剧情已变更', updatedAt: Date.now() }
          await T.status.put(taskKey, record).catch(() => {})
        } else {
          record = { ...durable, publicationState: 'retry', publicationError: '状态结果已提交，发布待重试' }
          await T.status.put(taskKey, record).catch(() => {})
        }
        const retries = (statusRetryCounts.get(taskKey) ?? 0) + 1
        statusRetryCounts.set(taskKey, retries)
        if (live && retries <= 3 && !statusDisposed && !signal?.aborted) {
          const retrySignal=cancellation.retrySignal()
          const timer = setTimeout(() => {
            statusRetryTimers.delete(taskKey)
            if(retrySignal?.aborted)return
            runStatusObligation(session, event, 'retry', { agent, signal:retrySignal }).catch(() => {})
          }, Math.max(1, Number(cfg.statusRetryMs) || 2000) * retries)
          timer.unref?.()
          statusRetryTimers.set(taskKey, timer)
        }
        ctx.logger?.warn?.(`roleplay: status obligation ${live ? 'retry' : 'stale'} turn=${source.turnId} seq=${event.seq}`)
        return cloneBranchRecord(T.status.get(taskKey)) ?? null
      }
    }).finally(() => { cancellation.dispose(); admitted(null); if (statusJobs.get(taskKey) === job) statusJobs.delete(taskKey) })
    job.admission=admission
    job.cancellation=cancellation
    statusJobs.set(taskKey, job)
    return job
  }

  function queueStatusObligation(session, event, via, agent, signal) {
    runStatusObligation(session, event, via, { agent, signal }).catch(() => {
      ctx.logger?.warn?.(`roleplay: status admission failed turn=${event?.data?.turn}`)
    })
  }

  function recoverStatusObligations(session, via, agent) {
    const latest = latestStatusEvent(session)
    const lastBoundary = eventsOf(session).findLast(event => event.type === 'turn/start' || event.type === 'turn/end')
    if (lastBoundary?.type === 'turn/start' && (!latest || latest.seq < lastBoundary.seq)) return
    // A new worldline is about to replay its player input. Do not separately
    // backfill the inherited tail while its new story will settle that prefix.
    if (session.header?.parentSession && latest?.seq < Number(session.header.seedLength)) return
    const runStart = statusRunStartSeq.get(session.id) ?? Infinity
    // Recover pending durable work and this run's completed turns. A cold
    // legacy session only backfills its latest turn, not its entire archive.
    for (const entry of surfaceEntries(session)) {
      if (entry.kind !== 'assistant') continue
      const record = T.status.get(keyOf(session.id, `turn-${entry.turn}-${entry.seq}`))
      if (entry.seq === latest?.seq || entry.seq > runStart ||
        (record && (record.state === 'running' || record.state === 'waiting-main' || record.state === 'retry' || record.publicationState === 'retry'))) {
        const event = canonicalAssistantForTurn(session, entry.turn)
        if (event) queueStatusObligation(session, event, via, agent)
      }
    }
  }
  const recoverStatusSpecFromImport = async (session) => {
    const active = T.branch.get(importActiveKey(session.id))
    const sourceSessionId = active?.sourceRecordSessionId ?? session.id
    const record = active?.importId ? T.branch.get(importRecordKey(sourceSessionId, active.importId)) : null
    if (!record || typeof record.normalizedSource !== 'string') return null
    const spans = (record.assignments ?? [])
      .filter((assignment) => assignment.target === 'status')
      .flatMap((assignment) => assignment.sourceSpans ?? [])
    if (!spans.length) return null
    const restored = spans.map((span) => spanText(record, [span])).join('')
    if (!restored.trim()) return null
    const current = cloneBranchRecord(T.status.get(keyOf(session.id, 'spec'))) ?? {}
    const next = { ...current, text: restored, templateHtml: restored, recoveredFromImport: true, recoveredAt: Date.now(), importId: record.importId, normalizedSha256: record.normalizedSha256 }
    await T.status.put(keyOf(session.id, 'spec'), next)
    return next
  }
  const normalizeStatusRecord = (record) => {
    if (!record || typeof record !== 'object') return null
    return { ...record, panel: normalizeStatusPanel(record.panel ?? record) }
  }
  const normalizeDecisionRecord = (record) => {
    if (!record || typeof record !== 'object') return null
    return {
      ...record,
      options: Array.isArray(record.options)
        ? record.options.map(normalizeStatusOption).filter((option) => option.label).slice(0, 4)
        : [],
    }
  }
  const userValues = (branchId) => {
    const info = readUserInfo() ?? {}
    const card = T.cards.get(keyOf(branchId, 'user')) ?? {}
    return {
      name: textAlias(info, ['name', 'user', 'displayName']) || textAlias(card, ['name', 'title']) || '用户',
      gender: textAlias(info, ['gender', 'sex']),
    }
  }

  // domain 生命周期归本 fiber：卸载/失败挂载时必须 close，否则域名泄漏、
  // 重挂载会撞上 "already open"。
  ctx.effect(() => () => domain.close(), 'roleplay: close domain')

  const ensureState = (sessionId) => {
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

  const resolveRoute = (session, agent) => ({ session, agent: agent ?? taskAgents.get(session.id) })

  const isRoleplaySession = (session) => {
    if (!session) return false
    if(eventsOf(session).some(e=>e?.type==='subagent/descriptor'&&Number(e.seq)>=Number(session.header?.seedLength??0)))return false
    let preset = session.header?.agentPreset
    for (const e of eventsOf(session)) {
      if (e && e.type === 'agent-preset/selected' && e.data?.agentPreset) preset = e.data.agentPreset
    }
    return preset === 'roleplay'
  }

  const memoryForContext = (session) => {
    const projection = ctx.get('compaction')?.memoryProjection
    if (typeof projection === 'function') return projection(session)
    const stored = T.memory.get(keyOf(session.id, 'head')) ?? null
    if (!stored || typeof session?.header?.parentSession !== 'string') return stored
    const seedLength = durableSeq(session.header?.seedLength)
    const proven = (items) => (Array.isArray(items) ? items : []).filter((item) => {
      if (!item || typeof item !== 'object') return false
      const owners = [item.sessionId, item.branchId, item.ownerSessionId]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
      if (owners.length > 0 && owners.every((owner) => owner === session.id)) return true
      const seq = provenanceSeq(item)
      return seedLength !== null && seq !== null && seq < seedLength
    })
    const checkpoint = visibleCompactionCheckpoint(session)
    const summarySeq = [stored.summaryAtSeq, stored.summarySeq, stored.surfaceCheckpointSeq, stored.lastCompactedSeq]
      .map(durableSeq)
      .find((value) => value !== null) ?? null
    // The memory head itself is updated on every Phase-B commit, so its generic
    // `sessionId` says nothing about who owns an older copied summary.  Only
    // summary-specific provenance may authorize it; conflicting aliases fail
    // closed rather than laundering a parent summary into the child branch.
    const summaryOwners = [stored.summarySessionId, stored.summaryBranchId]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
    const summaryOwnerConflict = new Set(summaryOwners).size > 1
    const safeInheritedMarker = seedLength !== null
      && String(stored.inheritedFrom ?? '') === String(session.header.parentSession)
      && durableSeq(stored.inheritedAtSeedLength) === seedLength
      && (summarySeq === null || summarySeq < seedLength)
    const safeStoredSummary = (!summaryOwnerConflict && summaryOwners.includes(session.id))
      || (seedLength !== null && summarySeq !== null && summarySeq < seedLength)
      || safeInheritedMarker
    const resolvedSummary = checkpoint?.text ?? (safeStoredSummary ? String(stored.summary ?? '') : '')
    const resolvedSummarySeq = checkpoint?.seq ?? (safeStoredSummary ? summarySeq : null)
    return {
      ...stored,
      // A lazy reader may omit the visible checkpoint, but a ledger summary is
      // accepted only with child ownership, a pre-seed seq, or the exact durable
      // inheritance marker written by ensureBranch. Unknown provenance fails
      // closed instead of leaking post-fork parent facts into this branch.
      summary: resolvedSummary,
      surfaceCheckpointSeq: resolvedSummarySeq,
      lastCompactedSeq: resolvedSummarySeq ?? -1,
      archives: proven(stored.archives),
      archiveDigests: proven(stored.archiveDigests),
      deltas: proven(stored.deltas),
      pendingConfirmations: proven(stored.pendingConfirmations),
      lockedFacts: proven(stored.lockedFacts),
      styleNotes: proven(stored.styleNotes),
      userPrefs: proven(stored.userPrefs),
    }
  }

  // ── 对外服务（供记忆引擎 / 未来 UI 半）─────────────────────────────────────

  const svc = {
    nativeTask,
    ownsMemoryPreparation: true,
    isStoryBranchActive: storyBranchIsActive,
    async awaitCommitted(branchId, waitMs = 0) {
      const st = ensureState(branchId)
      const pending = (st.commitChain ?? Promise.resolve()).catch((error) => {
        ctx.logger?.warn?.(`roleplay: prior commit failed; continuing from last durable state: ${String(error)}`)
      })
      const boundedWaitMs = Number(waitMs)
      if (!Number.isFinite(boundedWaitMs) || boundedWaitMs <= 0) {
        await pending
        return { completed: true, timedOut: false }
      }
      let timeoutId
      const timeout = new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve({ completed: false, timedOut: true }), boundedWaitMs)
      })
      const result = await Promise.race([
        pending.then(() => ({ completed: true, timedOut: false })),
        timeout,
      ])
      clearTimeout(timeoutId)
      if (result?.timedOut) {
        ctx.logger?.warn?.(`roleplay: prior Phase-B commit still running after ${boundedWaitMs}ms; using last durable snapshot`)
      }
      return result
    },
    surfaceText(sessionId, seqs) {
      const session = ctx.sessions.get(sessionId)
      if (!session) return ''
      return surfaceTextForSeqs(session, seqs)
    },
    lockedFacts(branchId) {
      return lockedFactsOf(T, branchId)
    },
    memoryHead(branchId) {
      return T.memory.get(keyOf(branchId, 'head')) ?? null
    },
    async memoryUpdate(branchId, patch) {
      const key = keyOf(branchId, 'head')
      if (!T.memory.get(key)) {
        await T.memory.put(key, { schemaVersion: 1, deltas: [], lockedFacts: [], version: 1 })
      }
      return T.memory.update(key, (current) => ({
        ...current,
        ...cloneBranchRecord(patch),
        schemaVersion: 1,
        version: (Number(current?.version) || 1) + 1,
      }))
    },
    sceneCurrent(branchId) {
      return T.scene.get(keyOf(branchId, 'current')) ?? null
    },
    branchLineage(session) {
      const chain = []
      let cur = session
      let depth = 0
      while (cur && depth < 64) {
        chain.push({ sessionId: cur.id, parentSession: cur.header?.parentSession ?? null, seedLength: cur.header?.seedLength ?? null })
        if (!cur.header?.parentSession) break
        cur = ctx.sessions.get(cur.header.parentSession)
        depth++
      }
      return chain
    },
    settings(branchId) {
      return memorySettingsPolicy(branchId).effective
    },
    async setSettings(branchId, patch) {
      const prev = T.branch.get(keyOf(branchId, 'settings')) ?? {}
      const next = { ...prev, ...patch, updatedAt: Date.now() }
      await T.branch.put(keyOf(branchId, 'settings'), next)
      return next
    },
    versions(branchId) {
      return T.branch.get(keyOf(branchId, 'versions')) ?? { anchors: {} }
    },
    async recordVersion(branchId, anchorSeq, turn, seq) {
      const key = keyOf(branchId, 'versions')
      if (!T.branch.get(key)) await T.branch.put(key, { anchors: {} })
      return T.branch.update(key, (current) => {
        const rec = cloneBranchRecord(current) ?? { anchors: {} }
        const group = cloneBranchRecord(rec.anchors?.[String(anchorSeq)]) ?? { entries: [] }
        const nextEntry = { turn: Number(turn), seq: Number(seq) }
        // Phase-B retries and an idle compatibility callback can observe the
        // same completed assistant twice.  Version history is a set of durable
        // assistant occurrences, so retrying must not create a duplicate slot.
        if ((group.entries ?? []).some((entry) => Number(entry?.seq) === nextEntry.seq)) return rec
        group.entries = [...(group.entries ?? []), nextEntry]
          .sort((a, b) => a.seq - b.seq)
        rec.anchors = { ...(rec.anchors ?? {}), [String(anchorSeq)]: group }
        return rec
      })
    },
    statusSpec(branchId) {
      return T.status.get(keyOf(branchId, 'spec')) ?? null
    },
    async setStatusSpec(branchId, text, atSeq) {
      const rec = { text: String(text ?? ''), updatedAt: Date.now(), ...(Number.isSafeInteger(atSeq) ? { updatedAtSeq: atSeq } : {}) }
      await T.status.put(keyOf(branchId, 'spec'), rec)
      return rec
    },
    rulesOf(branchId) {
      return T.rules.get(keyOf(branchId, 'spec')) ?? null
    },
    async setRules(branchId, record, atSeq) {
      const next = { ...record, schemaVersion:1, updatedAt: Date.now(), ...(Number.isSafeInteger(atSeq) ? { updatedAtSeq: atSeq } : {}) }
      await T.rules.put(keyOf(branchId, 'spec'), next)
      return next
    },
    opening(branchId) {
      return T.opening.get(keyOf(branchId, 'scene')) ?? null
    },
    async setOpening(branchId, text, atSeq) {
      const rec = { text: String(text ?? ''), updatedAt: Date.now(), ...(Number.isSafeInteger(atSeq) ? { updatedAtSeq: atSeq } : {}) }
      await T.opening.put(keyOf(branchId, 'scene'), rec)
      return rec
    },
    userInfo() {
      return readUserInfo()
    },
    async setUserInfo(record) {
      const next = { ...(readUserInfo() ?? {}), ...record, updatedAt: Date.now() }
      writeUserInfo(next)
      return next
    },
    decision(branchId) {
      return normalizeDecisionRecord(T.decision.get(keyOf(branchId, 'current')))
    },
    contextWindow(branchId) {
      const value = T.branch.get(contextWindowKey(branchId))
      return value ? cloneContextWindow(value) : null
    },
    async askDecision(branchId, record) {
      const rec = {
        source: record?.source ?? 'tool',
        seq: Number.isSafeInteger(record?.seq) ? record.seq : 0,
        turnId: record?.turnId ?? null,
        question: String(record?.question ?? ''),
        header: record?.header !== undefined ? String(record.header).slice(0, 60) : undefined,
        options: Array.isArray(record?.options)
          ? record.options
              .map(normalizeStatusOption)
              .filter((o) => o.label)
              .map((o) => ({
                ...o,
                label: o.label.slice(0, 60),
                description: o.description ? o.description.slice(0, 120) : undefined,
              }))
              .slice(0, 4)
          : [],
        multiSelect: record?.multiSelect === true,
        answered: false,
        choiceIndex: null,
        time: Date.now(),
      }
      await T.decision.put(keyOf(branchId, 'current'), rec)
      return rec
    },
  }
  ctx.provide('roleplay', svc)

  // ── systemPrompt：{{user}}/{{user_gender}} 变量 + 角色卡 section ─────────────
  // 优先级：用户信息（设置页填写）> 玩家角色卡名 > 默认「用户」。

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'roleplay:card-workflows', order: 145,
    text: context => {
      if (Number(context.agent?.options?.subagentDepth)>0) return ''
      if (!isRoleplaySession(context.agent?.session)) return ''
      return `${CARD_CLASSIFICATION_GUIDE}\n【玩家读卡与导出：系统默认工作流】
玩家不是程序员，不需要提供工具名、游标、哈希、覆盖率或实现步骤。识别自然语言意图：“读取这张角色卡，准备开始角色扮演”“导入这张卡”使用读卡流程；“导出角色卡”“把设定保存成文件”使用逆向组卡流程。不要把这些管理请求扩写成剧情。角色设定导出不同于小说正文导出。
创作新卡或检查新卡草稿：加载最新 roleplay-card-authoring 技能，使用 rp_card_draft_check 进入写卡管理与检查文件。12项是AI内部清单，不让用户填工程表或设计CSS；默认用原生 questions 自然聊故事偏好，再把喜好映射成完整卡。用户说你来决定可跳过剩余问卷，但主代理仍逐项审阅；大纲统一后可并行细化独立模块。交付实际文件链接，不把写卡回执或偏好问答当剧情，不另写重复校验脚本。
读卡：使用本次附件提供的工作区文件路径或玩家指明的文件。PNG/JSON 直接 rp_card_import_begin，不用图片识别、anydoc 或脚本解析；Markdown/TXT 也直接 begin，PDF/DOCX 才先转换为持久 Markdown。没有附件或路径时只请玩家提供卡片；多个候选不明确时只确认文件，不能翻找旧会话或参考卡代替。普通玩家无需指定格式版本或导入参数。
按 rp_card_import_begin → rp_card_import_chunk → rp_card_import_stage → rp_card_import_finalize 完成导入。chunk 严格跟随 nextCursor 从 1 到 null；完整审阅后按语义分到人物 card、常驻世界背景 core-setting、尚未发生的路线 plot-guidance、完整文风示例 rule-style、被动检索 worldbook 和其他栏目。PNG/JSON 的 suggestedMapping 只是建议；字段混有多种模块时必须按完整原文跨度细分，只有建议确实符合全文语义才用 use_suggested:true。完整新卡默认 replace，明确补充包才 merge。作者设定、状态栏、美化、原始开场和未知字段完整保存，不精简、不改写。激活成功后展示作者原始开场，不提前续写；没有开场才等待玩家行动。状态栏由系统轮末生成。
导出：无须玩家再次指定角色或格式，默认当前选中分支已保存的最新人设、世界书、规则、开场与附加设定，保留全部细节，原件不能覆盖编辑。直接 rp_card_export_begin → rp_card_export_chunk（从 0 沿 nextCursor 读到 null）→ rp_card_export_finalize。深入审阅每项来源，按上方创作用途组织统一 Markdown 章节：用户新增镜头语言放叙事规则，不照搬存储字段名。完整来源用 source_ids；混合来源再用 chunk(source_id) 查看行号，按 source_parts 分到相应章节，每行恰好一次；不精简，不用摘要、手写文件或静态拼接替代原生导出。后端负责完整物化与校验；成功后给出文件与简短完成说明，不复述技术流程，不推进故事。
恢复：用工具实际返回的 ID、游标和哈希；漏页/缺项按错误补齐，临时失败以相同参数有限重试，导出期间设定已改变就重新 begin。无效文件、权限错误或 recoveryRequired 时用普通语言说明未完成及可行下一步；不声称成功、不检查服务器代码、不改原卡或绕开校验。详细规范可读取 roleplay-card-authoring 技能，用户不需要承担这些约束。`
    },
  }), 'roleplay: player card workflows')

  ctx.effect(
      () =>
      ctx.systemPrompt.variable('user', (context) => {
        const session = context.agent?.session
        return userValues(session?.id).name
      }),
    'roleplay: user variable'
  )

  ctx.effect(
      () =>
      ctx.systemPrompt.variable('user_gender', (context) => {
        return userValues(context.agent?.session?.id).gender
      }),
    'roleplay: user_gender variable'
  )
  ctx.effect(()=>ctx.systemPrompt.variable('char',context=>{
    const prefix=`${context.agent?.session?.id}__`
    const cards=[...T.cards.entries()].filter(([key,card])=>key.startsWith(prefix)&&card?.kind!=='user')
      .sort(([a],[b])=>a<b?-1:a>b?1:0)
    return String(cards[0]?.[1]?.name??'角色')
  }),'roleplay: char variable')

  const fixedAuthorFence=createStableRoleplayFence()
  ctx.effect(()=>ctx.systemPrompt.section({name:'roleplay:character-cluster',order:170,text:context=>{
    const session=context.agent?.session
    if(!session||Number(context.agent?.options?.subagentDepth)>0||!isRoleplaySession(session)||!characterCluster.read(session).enabled)return ''
    return `【角色 agent 集群已开启】除读卡、写卡问答、管理与诊断回合之外，每轮正式剧情动笔前调用一次 rp_character_cast。先判断本回合预计出场的主要人物（作者预设或推动剧情的重要人物，排除路人），按 ID 选角；没有主要人物可传空列表。资料不足时先按需查世界书，程序会把当前与最近三个剧情回合已读资料、当前窗口正文、核心设定、各自人设和导演笔记注入独立子代理。不要手工复制或概括这些上下文。新出现且逐渐重要的人物先用 rp_card_set 保存独立人设，再选入集群；现有人物不要重复登记。等待工具返回后把各人物意向作为参考，协调矛盾再写正文。临场出现的意外人物可自由发挥，不必再次调用集群。当前可选人物：${JSON.stringify(characterRoster(session).map(({id,name})=>({id,name})))}`
  }}),'roleplay: character cluster writer instructions')
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: 'roleplay:cards',
        order: 150,
        text: (context) => {
          if (Number(context.agent?.options?.subagentDepth)>0) return ''
          const session = context.agent?.session
          if (!session || !isRoleplaySession(session)) return ''
          try {
            const cards = renderCards(T, session.id)
            if (!cards.trim()) return ''
            return fixedAuthorFence(cards, 'card')
          } catch {
            return ''
          }
        },
      }),
    'roleplay: cards section'
  )

  // 固定创作设定完整常驻；剧情路线和写作样本不是已发生的剧情。
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: 'roleplay:rules',
        order: 160,
        text: (context) => {
          if (Number(context.agent?.options?.subagentDepth)>0) return ''
          const session = context.agent?.session
          if (!session || !isRoleplaySession(session)) return ''
          try {
            const parts = []
            const rules = T.rules.get(keyOf(session.id, 'spec'))
            if (rules?.core) parts.push('【核心设定·固定世界基础】\n' + rules.core)
            const legacyPinned=[...T.worldbook.entries()].filter(([key,e])=>key.startsWith(`${session.id}__`)&&e?.enabled!==false&&e?.alwaysOn===true)
              .sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,e])=>renderWorldbookEntry(e))
            if(legacyPinned.length)parts.push('【核心设定·旧卡常驻标记兼容投影】\n以下原文由旧constant/always_on标记明确指定为常驻，按核心设定保留；其余世界书条目只按本轮查询读取。\n'+legacyPinned.join('\n\n'))
            if (rules?.plot) parts.push('【剧情指引·尚未发生的作者路线】\n以下目标、触发条件和结局仅是可能性；只有所选分支已发生的事件能满足条件。不能把路线写成既成事实，不能替玩家选择路线。\n' + rules.plot)
            if (rules?.narrative) parts.push('【叙事规则】\n' + rules.narrative)
            if (rules?.reply) parts.push('【回复规则】\n' + rules.reply)
            if (rules?.style) parts.push('【文风特化·作者要求与完整样本】\n模仿叙述方式、节奏与语言质感；示例不是当前剧情，不代表事件已经发生，不搬用样本中的人物与事件。\n' + rules.style)
            parts.push('【世界书查询】世界书是被动资料库，不是常驻背景。根据导演笔记和当前问题，用 rp_worldbook_search 的明确关键词查阅；不要把旧检索结果当作永久上下文。')
            const statusSpec = T.status.get(keyOf(session.id, 'spec'))
            if (statusSpec?.text) parts.push('【状态规则·创作参考】（遵守其中的数值与状态约束；状态栏及行动建议由程序在正文落盘后交给维护任务生成。主代理只写故事，不生成面板或调用 rp_status_set。）\n' + statusSpec.text)
            if (!parts.length) return ''
            return fixedAuthorFence(parts.join('\n\n'), 'rules')
          } catch {
            return ''
          }
        },
      }),
    'roleplay: rules section'
  )

  // ── 阶段 A：程序组装当前分支笔记与窗口；主代理按需查资料 ──────────────────
  const memorySettingFields=['contextWindowTokens','continuityTailTokens','autoNotesEveryTurns','targetContextTokens','archiveTokens']
  function memorySettingsPolicy(sessionId) {
    const global=T.branch.get('memory-settings-global')
    if(global&&global.schemaVersion!==1)throw new Error('不支持的全局记忆设置版本')
    const local=T.branch.get(keyOf(sessionId,'settings'))
    const defaults={contextWindowTokens:cfg.contextWindowTokens,continuityTailTokens:cfg.continuityTailTokens,
      autoNotesEveryTurns:3,targetContextTokens:262144,archiveTokens:100000,...ctx.get('compaction')?.settingsDefaults?.()}
    const pick=value=>Object.fromEntries(memorySettingFields.filter(f=>value?.[f]!==undefined).map(f=>[f,value[f]]))
    const effective={...defaults}
    for(const layer of [global?.settings,local])for(const f of memorySettingFields)if(Number(layer?.[f])>0)effective[f]=Number(layer[f])
    return {schemaVersion:1,sessionId,defaults,global:{settings:pick(global?.settings),revision:recordSha256(global)},
      session:{settings:pick(local),revision:recordSha256(local)},effective}
  }
  function storyWindowSettings(session) {
    const settings=svc.settings(session.id)
    return {
      limit:Math.max(1000,Number(settings?.contextWindowTokens)||Number(cfg.contextWindowTokens)||230000),
      tail:Math.max(1000,Number(settings?.continuityTailTokens)||Number(cfg.continuityTailTokens)||18000),
    }
  }

  async function buildPhaseA(session, payload, st) {
    assertStoryBranchActive(session)
    const phaseAStartedAt = Date.now()
    const branchId = session.id
    await ensureBranch(session)
    await reconcileCanonicalPlayerVariants(session, buildForkLookupIndex())
    // Read only committed branch state. Background notes need not finish on
    // ordinary turns; eviction below is the sole strict notes-save barrier.
    await svc.awaitCommitted(branchId)
    let memoryPreparation = { status: 'ready' }
    try {
      memoryPreparation = await ctx.get('compaction')?.prepareForTurn?.(payload.agent, payload.signal) ?? memoryPreparation
    } catch (error) {
      if (isInlinePending(error) || payload.signal?.aborted || error?.code === 'ROLEPLAY_SOURCE_CHANGED') throw error
      memoryPreparation = { status: 'retry', branchId, reason: '当前分支持久记忆准备失败，可重试' }
    }
    assertStoryBranchActive(session)
    const userMsg = payload.messages.findLast((m) => m.role === 'user' && m.source?.kind === 'user')
    const userText = userMsg ? textOf(userMsg.content) : ''
    const mem = memoryForContext(session)
    let directorNotes = ctx.get('compaction')?.directorNotes?.(session)

    // 快照（不可变；worker 只读）
    const baseRevision = lastSeq(session)
    const currentContextWindow = await ensureContextWindow(session, 'initial')
    const storyStartSeq = Number.isSafeInteger(currentContextWindow.startSeq)
      ? currentContextWindow.startSeq
      : -1
    const storySinceWindow = surfaceEntries(session)
      .filter((entry) => entry.seq > storyStartSeq)
    const storySinceTokens = storySinceWindow.reduce((sum, entry) => sum + estimateTokens(entry.text), 0)
    const windowSettings=storyWindowSettings(session)
    const rolloverNeeded = cfg.contextWindowEnabled !== false
      && storySinceTokens >= windowSettings.limit
    if (!rolloverNeeded && cfg.contextWindowEnabled !== false
      && storySinceTokens >= windowSettings.limit * 0.9) {
      Promise.resolve(ctx.get('compaction')?.prefetchWindowCheckpoint?.(payload.agent))
        .catch(() => ctx.logger?.warn?.('roleplay: early checkpoint save failed; window retained'))
    }
    let activeContextWindow = rolloverNeeded
      ? await rolloverContextWindow(session, {
          reason: 'roleplay-story-window-pressure',
          // The old window is cut before this turn.  The current turn's user
          // message is admitted into the new prompt and the continuity tail
          // is selected from the retained downstream messages below.
          startSeq: baseRevision,
          previousStoryTokens: storySinceTokens,
          continuityTailTokens: windowSettings.tail,
        }, { persist: false })
      : currentContextWindow
    let didRollover = false
    if (rolloverNeeded) {
      try {
        const checkpoint = await installRoleplayWindowCheckpoint(
          session,
          currentContextWindow,
          activeContextWindow,
          windowSettings.tail,
          payload.agent, payload.signal,
        )
        if (checkpoint) {
          const committedWindow = {
            ...activeContextWindow,
            // The continuity tail is part of the new model window.  Advance
            // the boundary to just before its first visible story node;
            // using the pre-rollover lastSeq here would drop the tail on the
            // very next request.
            startSeq: checkpoint.tailSeqs.length > 0
              ? Number(checkpoint.tailSeqs[0]) - 1
              : activeContextWindow.startSeq,
            checkpointSeq: checkpoint.checkpointSeq,
            shadowedSeqs: checkpoint.shadowedSeqs,
            tailSeqs: checkpoint.tailSeqs,
            continuityTokens: checkpoint.usedTokens,
          }
          await T.branch.put(contextWindowKey(session.id), committedWindow)
          activeContextWindow = committedWindow
          didRollover = true
          directorNotes = ctx.get('compaction')?.directorNotes?.(session)
        } else {
          activeContextWindow = currentContextWindow
        }
      } catch (error) {
        activeContextWindow = currentContextWindow
        ctx.logger?.warn?.(`roleplay: context-window checkpoint failed; keeping previous window: ${String(error)}`)
        throw error
      }
    }
    const snapshot = {
      branchId,
      agent: payload.agent,
      turnId: payload.turn,
      baseRevision,
      lastSeq: baseRevision,
      userMessageId: typeof userMsg?.id === 'string' ? userMsg.id : null,
      userText,
      cardVersion: null,
      worldbookVersion: null,
      memoryVersion: mem?.version ?? null,
      contextWindow: {
        windowNumber: activeContextWindow.windowNumber,
        windowId: activeContextWindow.windowId,
        previousWindowId: activeContextWindow.previousWindowId ?? null,
          rollover: didRollover,
      },
    }

    // Deterministic context assembly. The author already sees the selected
    // native story window; no scene/recall model and no automatic lore lookup.
    snapshot.memoryProjection={schemaVersion:1,branchId,mode:'direct-notes',
      notesGenerationId:directorNotes?.generationId??null,
      notesSourceSeqs:directorNotes?.sourceSeqs??[],windowId:activeContextWindow.windowId}
    const visibleAnchor = (form, hashField, hash) => [...surfaceEvents(session)].reverse().find((event) => {
      const source = event?.type === 'user/message' ? event.data?.source : null
      return source?.kind === 'plugin' && source.plugin === 'roleplay-context'
        && source.form === form && source.branchId === branchId && source.mode === 'full' && source[hashField] === hash
    }) ?? null
    const contextMessage = (form, source, body) => ({
      id: randomUUID(), role: 'user', content: [{ type: 'text', text: body }],
      source: { kind: 'plugin', plugin: 'roleplay-context', form, schemaVersion: 1, branchId, ...source },
    })
    const values = userValues(branchId)
    const renderContextText = value => String(value ?? '')
      .replace(/\{\{\s*(?:user|user_name)\s*\}\}/gi, values.name)
      .replace(/\{\{\s*(?:user[_-]gender|userGender)\s*\}\}/gi, values.gender)
    const anchors = []
    const renderedNotes = renderContextText(directorNotes?.text)
    const notesHash = sha256(stableJson({ text: renderedNotes, sourceKeys: directorNotes?.sourceKeys ?? [], sourceSeqs: directorNotes?.sourceSeqs ?? [] }))
    const priorNotes = visibleAnchor('director-notes', 'notesHash', notesHash)
    anchors.push(contextMessage('director-notes', { notesHash, notesGenerationId: directorNotes?.generationId ?? null, mode: priorNotes ? 'reference' : 'full' }, priorNotes
      ? `[导演笔记锚点·当前版本优先·引用版本 ${notesHash}]\n请读取上方标有“完整版本 ${notesHash}”的同分支完整锚点；沿用该版本，不采用较早或其他分支版本。`
      : renderedNotes
        ? `[导演笔记锚点·当前版本优先·完整版本 ${notesHash}]\n以下是当前分支最新已核验导演笔记；若上方存在较早锚点，以本版本为准。\n${renderedNotes}`
        : `[导演笔记锚点·当前版本优先·完整版本 ${notesHash}]\n本分支当前没有可用导演笔记；所有较早导演笔记均已失效，不得继续采用。`))
    const sections = []
    if (Array.isArray(mem?.lockedFacts) && mem.lockedFacts.length) {
      sections.push('[用户锁定的剧情事实]\n'+mem.lockedFacts.map(fact=>typeof fact==='string'?fact:String(fact?.text??'')).filter(Boolean).join('\n'))
    }
    sections.push('[按需查阅资料]\n当前窗口正文和已核验导演笔记由程序直接提供。你是负责写作的主代理：现有信息充分时直接创作；发现旧事件细节缺口时调用 rp_history search/read，需要世界知识时调用 rp_worldbook_search 或 rp_worldbook_list/read。自行判断查询词与是否继续读取，不要每轮例行检索，不把资料查询过程写成剧情。')
    if (didRollover) sections.push(`[角色扮演上下文窗口]\n已进入第 ${activeContextWindow.windowNumber} 个剧情窗口。旧窗口的来源与检查点已保存；缺少细节时通过 rp_history 读取所选分支原文。`)
    // 初始剧情：仅在故事尚未开始（还没有任何正文回复）时注入一次；
    // 要求模型输出第一幕（原文或适度润色），而不是跳过开场直接开下一幕
    const storyStarted = surfaceEntries(session).some((entry) => entry.kind === 'assistant')
    if (!storyStarted) {
      const opening = T.opening.get(keyOf(branchId, 'scene'))
      if (opening?.text) {
        sections.push(`[初始剧情]（分类写入的开场剧情）\n${fenceCardContent(opening.text, 'opening')}\n\n【本轮要求】请完整输出作者原始第一幕，不提前续写；围栏符号和资料说明不属于正文。`)
      }
    }

    // 状态栏·当前：把上一轮独立生成的状态栏拼接回上下文（模型据此延续数值与选项；
    // 每轮正文后状态栏会单独更新，正文中不要复述状态栏内容）
    const statusPanelRec = selectedStatusRecord(session)
    const statusPanel = statusPanelRec?.stale ? null : statusPanelRec?.panel
    if (statusPanel && (statusPanel.rawText || (statusPanel.fields ?? []).length || (statusPanel.options ?? []).length)) {
      const lines = []
      if (statusPanel.title) lines.push(`标题：${statusPanel.title}`)
      for (const f of statusPanel.fields ?? []) {
        lines.push(`${f.emoji ?? ''}${f.label ? f.label + '：' : ''}${f.value ?? ''}`)
      }
      if (statusPanel.rawText) lines.push(statusPanel.rawText)
      if ((statusPanel.options ?? []).length) {
        lines.push('当前选项（用户可点击填入输入框）：' + statusPanel.options.map((o) => (o.heart ? '❤️' : '') + o.label).join(' / '))
      }
      sections.push(`[状态栏·当前]（上一轮状态；按状态栏设定在正文后单独更新）\n${lines.join('\n')}`)
    }

    const styles = (mem?.styleNotes ?? []).map((s) => `${s.heading}：${s.text}`).join('\n')
    if (styles.trim()) sections.push('【风格笔记】\n' + styles)
    const prefs = (mem?.userPrefs ?? []).map((p) => `${p.heading}：${p.text}`).join('\n')
    if (prefs.trim()) sections.push('【用户偏好与边界】\n' + prefs)

    let hiddenText = '[角色扮演隐藏上下文·当前版本优先（本段是后台材料，不是对话；据此创作正文，但不要在正文中复述本段或提及"世界书/记忆/状态面板"等后台概念）]\n\n' + sections.join('\n\n')

    // Hidden user-role anchors do not pass through system-prompt interpolation.
    hiddenText = renderContextText(hiddenText)
    const stateHash = sha256(hiddenText)
    const priorState = visibleAnchor('state', 'stateHash', stateHash)
    anchors.push(contextMessage('state', { stateHash, mode: priorState ? 'reference' : 'full' }, priorState
      ? `[角色扮演可变上下文锚点·当前版本优先·引用版本 ${stateHash}]\n请读取上方标有“完整版本 ${stateHash}”的同分支完整锚点；沿用该版本，不采用较早或其他分支版本。`
      : `[角色扮演可变上下文锚点·当前版本优先·完整版本 ${stateHash}]\n${hiddenText}`))

    // 记录本轮快照与阶段 A 产出（阶段 C 提交时使用）
    st.snapshots.set(Number(payload.turn), snapshot)
    const {agent: snapshotAgent, ...durableSnapshot}=snapshot
    await T.branch.put(keyOf(session.id,`task-snapshot-${payload.turn}`),{schemaVersion:1,sessionId:session.id,...cloneRecord(durableSnapshot)})
    st.pendingScenes.set(Number(payload.turn), null)
    st.snapshot = snapshot
    st.pendingTurn = payload.turn
    st.pendingScene = st.pendingScenes.get(Number(payload.turn))
    ctx.logger?.info?.(`roleplay: context assembled in ${Date.now() - phaseAStartedAt}ms (turn ${payload.turn})`)

    return anchors
  }

  const preparationRecordKey = sid => keyOf(sid,'task-preparation')
  // Native scoped tool registrations (notably `subagent`) are exempt from
  // inherited toolFilter restrictions. Apply the actual task allowlist to
  // both the assembled request and execution, including those own-scope tools.
  ctx.on('system-prompt/assemble',async(_assembly,context,next)=>{
    const assembly=await next(),allowed=tavernTaskToolBoundary(T.branch,context.agent)
    if(clusterJob(context.agent))return {...assembly,contexts:assembly.contexts.filter(s=>/^(sandbox|approval):/.test(s.name)),tools:assembly.tools.filter(t=>t.name==='rp_history'),
      sections:[{name:'roleplay:character-persona',text:CHARACTER_PERSONA},...assembly.sections.filter(s=>s.name==='tool:rp_history'||/^(sandbox|approval):/.test(s.name)||s.name==='harness:identity')]}
    if(!allowed){
      // Also strip stale catalogs supplied by cached/restored tool surfaces.
      if(!isRoleplaySession(context.agent?.session))return assembly
      const hidden=new Set(['rp_status_set',...(!characterCluster.read(context.agent.session).enabled?['rp_character_cast']:[])])
      if(!assembly.tools.some(tool=>hidden.has(tool.name)))return assembly
      return {...assembly,tools:assembly.tools.filter(tool=>!hidden.has(tool.name)),
        sections:assembly.sections.filter(section=>!hidden.has(section.name.replace(/^tool:/,'')))}
    }
    // Native toolFilter leaves own-scope tool instructions in the prompt even
    // when their schemas are removed. Do not instruct a data task to code,
    // browse, create children, or publish a GUI reply with unavailable tools.
    // Preserve task persona, identity, security sections and runtime contexts.
    const irrelevant=new Set(['harness:source','app:web-surface','ui:deliverable-file-references'])
    return {...assembly,tools:assembly.tools.filter(tool=>allowed.has(tool.name)),
      sections:assembly.sections.filter(section=>!irrelevant.has(section.name)
        &&(!section.name.startsWith('tool:')||allowed.has(section.name.slice(5))))}
  },{global:true})
  ctx.effect(()=>ctx.tools.guard?.(execution=>{
    const session=execution.agent?.session
    if(execution.name==='rp_status_set')return '旧状态工具已停用；正文完成后由系统自动维护状态栏，不要重试或改用其他写入工具。'
    const auxiliaryTools=tavernTaskToolBoundary(T.branch,execution.agent)
    if(auxiliaryTools&&!auxiliaryTools.has(execution.name))return '该维护任务只允许指定的来源工具；直接按结果契约返回，不创建子代理或检查实现代码。'
    if(!session||!isRoleplaySession(session))return
    let phase=null
    for(const event of [...eventsOf(session)].reverse()) {
      if(event.type==='turn/start'||event.type==='turn/end')break
      const source=event.type==='user/message'?event.data?.source:null
      if(source?.kind==='plugin'&&source.plugin==='roleplay-tasks'&&source.form==='phase'){phase=source.stage;break}
    }
    if(!phase||phase==='story'||phase==='character-cast')return
    const allowed=new Set(['rp_task_read','rp_task_submit','run_code'])
    const workflow=activeCardWorkflow(session)
    if(workflow)for(const name of workflow.kind==='card-import'
      ?['rp_card_import_begin','rp_card_import_chunk','rp_card_import_stage','rp_card_import_finalize']
      :['rp_card_export_begin','rp_card_export_chunk','rp_card_export_finalize'])allowed.add(name)
    if(!allowed.has(execution.name))return '内部酒馆维护只允许任务读取、提交及该任务的原生读卡/导出工具。不要排查服务器代码；按任务完整契约提交，失败可在酒馆管理重试。'
  }),'roleplay: maintenance tool boundary')
  const taskInstruction = session => inlineTaskInstruction(tavernTasks.pending(session),{sessionId:session.id})
  ctx.on('agent/pre-step', async (payload, next) => {
    const session=payload?.agent?.session
    if(!session||!isRoleplaySession(session)||Number(payload.agent?.options?.subagentDepth)>0)return next()
    taskAgents.set(session.id,payload.agent)
    const st=ensureState(session.id)
    // Preserve old records for diagnostics, but never resume superseded
    // per-turn semantic preparation after upgrading to direct notes.
    for (const job of tavernTasks.list(session)) {
      if (job.kind !== 'memory' || job.input?.taskStage || !['queued','running'].includes(job.status)) continue
      const system = String(job.input?.system ?? '')
      if (system.includes('场景状态分析器') || system.includes('记忆提取器')) {
        await tavernTasks.cancel(session, job.id)
      }
    }
    if(clusterPhase(session)?.stage==='character-cast'&&!characterCluster.read(session).enabled){
      const decision=await next()
      return decision?.kind==='enter'?{...decision,messages:[taskPhaseMessage('story','玩家已关闭角色集群，现在按通常方式创作正文。未完成的人物推演不是剧情事实。'),...decision.messages]}:decision
    }
    let preparation=T.branch.get(preparationRecordKey(session.id))
    if(preparation?.sessionId!==session.id)preparation=null
    const hasUser=payload.messages.some(m=>m.role==='user'&&m.source?.kind==='user')
    if(hasUser && payload.step===1) {
      if(!tavernTasks.pending(session).length)retireCompletedTaskContexts(session,payload.turn)
      retireRoleplayContexts(session,payload.turn)
      await withDecisionMutationLock(session.id,async()=>{
        const key=keyOf(session.id,'current'),decision=normalizeDecisionRecord(T.decision.get(key))
        if(decision&&decision.answered!==true&&decision.superseded!==true)await T.decision.put(key,{...decision,answered:true,superseded:true,supersededAt:Date.now(),supersededReason:'player-input'})
      })
      preparation={schemaVersion:1,id:randomUUID(),sessionId:session.id,branchId:session.id,turn:payload.turn,
        messages:cloneRecord(payload.messages),status:'preparing',createdAt:Date.now(),sourceHash:recordSha256(payload.messages)}
      await T.branch.put(preparationRecordKey(session.id),preparation)
    }
    await tavernTasks.invalidate(session)
    try {await resumeStatusMaintenance(session,payload.agent);await resumeMemoryWork(session,payload.agent,payload.signal);await resumeCardWorkflows(session,payload.agent,payload.signal);await resumeNovelExports(session,payload.agent,payload.signal)}
    catch(error){if(isInlinePending(error))return {kind:'enter',messages:inlineTaskMessages(session,'management',tavernTasks.pending(session))};throw error}
    if(!preparation || preparation.status!=='preparing')return next()
    // A deferred stage returns immediately; the main loop is never awaited by
    // its own pre-step handler. The original player message is appended once,
    // only when preparation has committed successfully.
    return withImportLock(session.id,'__phase-a__',async()=>{
      let decision
      try {
        decision=await next()
        if(decision?.kind!=='enter')return decision
        // Resumed preparations may contain last turn's injected context. Keep
        // only the original conversation input, never replay transient lore.
        const originalMessages=preparation.messages.filter(m=>m.source?.plugin!=='roleplay-context'&&m.source?.plugin!=='roleplay-tasks')
        const staged={...payload,messages:cloneRecord(originalMessages)}
        const hidden=await buildPhaseA(session,staged,st)
        await T.branch.put(preparationRecordKey(session.id),{...preparation,status:'completed',completedAt:Date.now()})
        const needsCast=characterCluster.read(session).enabled&&characterRoster(session).length>0&&!activeCardWorkflow(session)
        const restore=taskPhaseMessage(needsCast?'character-cast':'story',needsCast
          ?'本轮角色集群准备：现在还没有进入正文。请根据随后玩家输入选择预计出场的主要人物，先调用 rp_character_cast（无人出场时传空数组）。程序已备好人物上下文，禁止手工搬运。等待角色建议返回及程序的正文阶段通知后再开始写故事，不把选角说明写成正文。如果玩家要求读卡、写卡、管理或诊断，直接执行对应工具，不推演角色。'
          :'现在进入正常正文阶段。先前维护指令与工具结果仅是历史后台记录，不是待办或剧情；不要重复执行或复述。当前状态和笔记以随后最新锚点为准；以下是玩家原始输入。')
        const originalIds=new Set(preparation.messages.map(m=>m.id))
        const phaseSnapshot=st.snapshots.get(Number(payload.turn))??st.snapshot
        const messages=phaseSnapshot?.contextWindow?.rollover
          ?retainRoleplayWindowContinuity(session,decision.messages,storyWindowSettings(session).tail):decision.messages
        const remaining=messages.filter(m=>!originalIds.has(m.id)&&m.source?.plugin!=='roleplay-tasks'&&m.source?.plugin!=='roleplay-context')
        return {...decision,messages:[restore,...hidden,...originalMessages,...remaining]}
      } catch(error) {
        st.lastPreparedTurn=-1
        if(isInlinePending(error))return {kind:'enter',messages:inlineTaskMessages(session,'prepare',tavernTasks.pending(session))}
        // Fail closed: a missing prerequisite cannot admit unprepared prose.
        throw error
      }
    })
  })

  ctx.on('agent/turn-stopping',async({agent,turn,signal})=>{
    const session=agent?.session
    if(!session||!isRoleplaySession(session)||Number(agent.options?.subagentDepth)>0)return
    taskAgents.set(session.id,agent)
    const st=ensureState(session.id)
    try {await resumeCardWorkflows(session,agent,signal);await resumeNovelExports(session,agent,signal)}catch(error){if(!isInlinePending(error))throw error}
    const turnEvents=eventsOf(session).filter(e=>Number(e.data?.turn??e.data?.source?.turn)===Number(turn))
    const phase=clusterPhase(session)
    if(phase?.stage==='character-cast'&&!T.branch.get(keyOf(session.id,`cluster-plan-${turn}`))?.result){
      const management=turnEvents.some(e=>e.type==='tool/call'&&/^(rp_card_(import|export|draft)|rp_commit_card|rp_diagnose|rp_novel_export|ask_user_question)/.test(e.data?.name??''))
      if(!management){
        if(phase.castReminder===true)throw new Error('主代理未完成角色选角，本轮未进入正文；可重试或关闭角色集群')
        agent.steer(taskPhaseMessage('character-cast','尚未完成选角，以上文字不是正式剧情。现在调用 rp_character_cast，传主要人物 ID；不要再输出正文或完成报告。',{turn,castReminder:true}))
        return
      }
    }
    const preparation=T.branch.get(preparationRecordKey(session.id))
    if(preparation?.status!=='preparing') {
      let canonical=canonicalAssistantForTurn(session,turn)
      if(!canonical) {
        const hidden=internalTaskSeqs(session)
        canonical=surfaceEvents(session).findLast(e=>e.type==='assistant/message'&&Number(e.data?.turn)===Number(turn)&&!e.data?.interrupted&&!hidden.has(e.seq)&&textOf(e.data?.message?.content).trim())
        if(canonical)session.append('user/message',taskPhaseMessage('after-story','正文已经落盘，下面只完成本轮维护义务，不继续剧情。',{storySeq:canonical.seq,turn}),{surfaceOp:'append'})
      }
      if(canonical) {
        const releaseBatch=tavernTasks.holdBatch(session,agent)
        let statusWork,decisionWork,admitted
        const snapshot=st.snapshots.get(Number(turn))??T.branch.get(keyOf(session.id,`task-snapshot-${turn}`))
        try {
          statusWork=runStatusObligation(session,canonical,'agent/turn-stopping',{agent,signal})
          admitted=await (statusWork.admission??statusWork)
          if(admitted?.execution==='spawn'&&admitted.status!=='completed'&&snapshot) {
            decisionWork=publishTurnDecision(session,canonical,snapshot,textOf(canonical.data?.message?.content),signal)
            decisionWork.catch(error=>ctx.logger?.warn?.(`roleplay: decision card failed: ${String(error)}`))
            // Only wait for durable admission, never for a held child's result.
            await decisionWork.admission
          }
        } finally {releaseBatch()}
        // The story is already published. Keep required independent work in
        // this native turn so a fallback steers its next step instead of waking
        // another turn with its own reply/footer. Release batching BEFORE the
        // wait; inline tasks return waiting-main rather than awaiting ourselves.
        await statusWork
        signal?.throwIfAborted()
        if(snapshot) {
          decisionWork??=publishTurnDecision(session,canonical,snapshot,textOf(canonical.data?.message?.content),signal)
          const outcomes=await Promise.allSettled([decisionWork,runPhaseBC(session,canonical,st,snapshot,signal)])
          for(const outcome of outcomes)if(outcome.status==='rejected'&&!isInlinePending(outcome.reason))throw outcome.reason
        }
        if(T.branch.get(keyOf(session.id,`phaseb-${turn}`))?.state==='completed') {
          try {await ctx.get('compaction')?.finishTurn?.(agent,signal)}catch(error){if(!isInlinePending(error))throw error}
        }
      }
    }
    signal?.throwIfAborted()
    const pending=tavernTasks.pending(session)
    const attemptKey=keyOf(session.id,`task-steering-${turn}`),fingerprint=recordSha256(pending.map(j=>[j.id,j.generation,j.status]))
    const prior=T.branch.get(attemptKey),attempt=prior?.fingerprint===fingerprint?prior.attempt+1:1
    await T.branch.put(attemptKey,{schemaVersion:1,sessionId:session.id,turn,fingerprint,attempt,source:pending.map(j=>j.id)})
    if(pending.length&&attempt>3) {
      for(const job of pending)await tavernTasks.fail(session,job.id,'主循环多次结束但维护任务尚未提交，请重试')
      throw new Error('酒馆维护尚未完成，检查点已保留；可在酒馆管理中重试')
    }
    if(pending.length||preparation?.status==='preparing')agent.steer(taskPhaseMessage(preparation?.status==='preparing'?'prepare':'after-story',taskInstruction(session)))
  })
  // ── 阶段 B/C：正文出现后并行抽取 + 单写者提交 ──────────────────────────────

  function isStale(session, snapshot, canonicalSeq) {
    if (!storyBranchIsActive(session)) return true
    const log = eventsOf(session)
    if (!Array.isArray(log)) return true
    const surfaceNodes = session?.surface?.nodes
    if (!Array.isArray(surfaceNodes) || !Number.isSafeInteger(canonicalSeq)) return true
    const live = new Set(surfaceNodes)
    // Normal later turns append more live nodes and do not invalidate this turn.
    // Editing, deleting or regenerating shadows the old surface range; commit
    // only while both the selected input and canonical assistant output remain.
    if (!live.has(canonicalSeq)) return true
    if (typeof snapshot.userMessageId !== 'string' || !snapshot.userMessageId) return true
    const userEvent = log.find((event) =>
      event?.type === 'user/message' &&
      event?.surfaceOp === 'append' &&
      event?.data?.id === snapshot.userMessageId
    )
    return !userEvent || !live.has(userEvent.seq)
  }

  function isLatestVisibleTurn(session, turnId, assistantSeq) {
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
  const decisionJobs=new Map()
  // A task may be admitted by a tool or a recovery event before turn-stopping
  // attaches. Every owner can cancel the same durable task, including when
  // its original admission had no turn signal. Listeners end with the job.
  function taskCancellation(initial) {
    const controller=new AbortController(),listeners=new Map()
    const follow=signal=>{
      if(!signal||listeners.has(signal))return
      const abort=()=>controller.abort(signal.reason)
      listeners.set(signal,abort)
      signal.addEventListener('abort',abort,{once:true})
      if(signal.aborted)abort()
    }
    follow(initial)
    return {signal:controller.signal,follow,retrySignal:()=>listeners.size?AbortSignal.any([...listeners.keys()]):undefined,
      dispose:()=>{for(const [signal,abort] of listeners)signal.removeEventListener('abort',abort);listeners.clear()}}
  }
  function publishTurnDecision(session,event,snapshot,narrative,signal) {
    const key=`${session.id}:${event.seq}`
    if(decisionJobs.has(key)) {
      const existing=decisionJobs.get(key)
      existing.cancellation.follow(signal)
      return existing
    }
    const cancellation=taskCancellation(signal)
    let admitted
    const admission=new Promise(resolve=>{admitted=resolve})
    const work=Promise.resolve().then(()=>generateTurnDecision(session,event,snapshot,narrative,admitted,cancellation.signal))
      .finally(()=>{cancellation.dispose();admitted(null);if(decisionJobs.get(key)===work)decisionJobs.delete(key)})
    work.admission=admission
    work.cancellation=cancellation
    decisionJobs.set(key,work)
    return work
  }
  async function generateTurnDecision(session, event, snapshot, narrative, onAdmission, signal) {
    const branchId = session.id
    const key = keyOf(branchId, 'current')
    const canPublish = () => {
      const current = normalizeDecisionRecord(T.decision.get(key))
      const currentTurn = Number(current?.turnId)
      const requestedTurn = Number(snapshot.turnId)
      // Only a decision from this turn or a later turn can block publication.
      // A previous turn is deliberately superseded when the new narrative ends.
      if (current && Number.isFinite(currentTurn) && currentTurn > requestedTurn) return false
      if (current && currentTurn === requestedTurn) {
        if (current.answered === true || current.superseded === true) return false
        if (Array.isArray(current.options) && current.options.length > 0) return false
      }
      return isLatestVisibleTurn(session, snapshot.turnId, event.seq)
        && !isStale(session, snapshot, event.seq)
    }

    // Admission is serialized, but the worker call is not: holding the lock for
    // up to 60s would block a user answer or a new-turn supersede operation.
    const admitted = await withDecisionMutationLock(branchId, async () => canPublish())
    if (!admitted) return

    const toolInput = T.status.get(keyOf(branchId, `input-${Number(snapshot.turnId)}`))
    const source = statusSource(session, event)
    const inputMatches = toolInput?.sessionId === branchId && toolInput?.userSeq === source?.sourceSeqs?.[0] &&
      toolInput?.userHash === sha256(surfaceEntries(session).find(entry => entry.seq === toolInput.userSeq)?.text ?? '')
    const selection=await modelPolicy.resolve(session,'decision',snapshot?.agent)
    const candidates=[selectedStatusRecord(session),...(inputMatches?[normalizeStatusRecord(toolInput)]:[])]
    const panelNow=candidates.find(panel=>sameModelRoute(panel?.provenance?.actualRoute,selection.actualRoute)&&
      (Number(panel?.turnId)===Number(snapshot.turnId)||(panel?.turnId==null&&Number(panel?.atSeq??-1)>Number(snapshot.baseRevision)&&Number(panel?.atSeq??-1)<=Number(event.seq))))
    let executionProvenance=panelNow?{...panelNow.provenance,reusedFrom:'status',statusSeq:panelNow.atSeq}:null
    let decisionOptions = []
    const panelBelongsToTurn =
      Number(panelNow?.turnId) === Number(snapshot.turnId) ||
      (panelNow?.turnId == null &&
        Number(panelNow?.atSeq ?? -1) > Number(snapshot.baseRevision) &&
        Number(panelNow?.atSeq ?? -1) <= Number(event.seq))
    if (panelBelongsToTurn && Array.isArray(panelNow?.panel?.options)) {
      decisionOptions = panelNow.panel.options
        .map(normalizeStatusOption)
        .filter((option) => option.label)
        .map((option) => ({
          label: option.label.slice(0, 60),
          description: option.description ? option.description.slice(0, 120) : undefined,
          heart: option.heart === true,
        }))
        .slice(0, 3)
    }

    if (!decisionOptions.length) {
      const decisionContext=await buildDecisionContext(T,branchId,{narrative,userText:snapshot.userText,
        scene:T.scene.get(keyOf(branchId,'current')),memory:memoryForContext(session),
        directorNotes:ctx.get('compaction')?.directorNotes?.(session)?.text})
      const generated = await llmJson(ctx, resolveRoute(session, snapshot?.agent), {
        system: DECISION_SYSTEM,
        signal,
        onAdmission,
        selection,
        source:{events:taskStory(session).filter(e=>source.sourceSeqs.includes(e.seq)).map(e=>({seq:e.seq,hash:sha256(e.text)})),dependencies:decisionContext.dependencies},
        onResult:task=>{executionProvenance={taskId:task.id,generation:task.generation,actualRoute:task.actualRoute,execution:task.execution}},
        user:
          `当前分支的决策依据：\n${fenceCardContent(JSON.stringify(decisionContext.context),'decision')}\n\n依据最新正文、人物动机、导演笔记及本轮世界书查询提出可选行动。剧情指引是可能性，不是已发生事实；不要替玩家执行选项，不要泄露角色尚不知道的秘密。只输出决策卡选项 JSON，不输出美化代码。`,
        maxTokens: 800,
        temperature: 0.7,
        timeoutMs: Number(cfg.decisionWorkerTimeoutMs) || DEFAULT_CONFIG.decisionWorkerTimeoutMs,
      })
      if (generated && Array.isArray(generated.options)) {
        decisionOptions = generated.options
          .map(normalizeStatusOption)
          .filter((option) => option.label)
          .map((option) => ({
            label: option.label.slice(0, 60),
            description: option.description ? option.description.slice(0, 120) : undefined,
            heart: option.heart === true,
          }))
          .slice(0, 3)
      }
    }

    if (!decisionOptions.length) return
    return withDecisionMutationLock(branchId, async () => {
      if (!canPublish()) return
      const record = {
        schemaVersion: 1,
        source: 'auto',
        provenance:executionProvenance,
        sessionId: branchId,
        atSeq: event.seq,
        seq: event.seq,
        turnId: snapshot.turnId,
        question: '',
        options: decisionOptions,
        multiSelect: false,
        answered: false,
        choiceIndex: null,
        time: Date.now(),
      }
      if (T.decision.get(key) !== undefined && typeof T.decision.update === 'function') {
        await T.decision.update(key, (currentRaw) => {
          const current = normalizeDecisionRecord(currentRaw)
          if (Number(current?.turnId) === Number(snapshot.turnId) &&
            (current?.answered === true || current?.superseded === true)) return currentRaw
          if (current && Number.isFinite(Number(current.turnId))
            && Number(current.turnId) > Number(snapshot.turnId)) return currentRaw
          return record
        })
      } else {
        await T.decision.put(key, record)
      }
    })
  }

  async function runPhaseBC(session, event, st, suppliedSnapshot = null, signal) {
    const turnId = Number(event?.data?.turn)
    let snapshot = suppliedSnapshot ?? st.snapshots.get(turnId) ?? st.snapshot ?? T.branch.get(keyOf(session.id,`task-snapshot-${turnId}`))
    if (!snapshot) return
    if(internalTaskSeqs(session).has(event.seq))return
    if(eventsOf(session).some(e=>e.type==='tool/call'&&e.data?.name==='rp_card_import_begin'&&Number(e.data?.turn)===turnId))snapshot={...snapshot,userText:''}
    const narrative = textOf(event.data?.message?.content)
    if (!narrative.trim()) return
    const branchId = session.id
    const phaseKey = keyOf(branchId, `phaseb-${Number(snapshot.turnId)}`)
    const phaseRecord = cloneBranchRecord(T.branch.get(phaseKey))
    if (phaseRecord?.state === 'completed' && phaseRecord?.assistantSeq === Number(event.seq)) return
    try {
      await T.branch.put(phaseKey, {
        ...(phaseRecord ?? {}),
        state: 'running',
        turnId: Number(snapshot.turnId),
        assistantSeq: Number(event.seq),
        sessionId: branchId,
        startedAt: phaseRecord?.startedAt ?? Date.now(),
        attempt: (Number(phaseRecord?.attempt) || 0) + 1,
      })
    } catch (error) {
      st.phaseBStarted.delete(Number(snapshot.turnId))
      throw error
    }
    let committed = false

    // 新分支的回复一旦 durable，就把真实 messageId 回填到跨 Session 分页
    // 索引；失败只影响导航，不应阻断本轮记忆/状态提交。
    try {
      await reconcileNativeFork(session, event)
    } catch (error) {
      ctx.logger?.warn?.(`roleplay: native branch reconciliation failed: ${String(error)}`)
    }

    const route = resolveRoute(session, snapshot?.agent)
    const backgroundMemory = ctx.get('compaction')?.backgroundMemory === true
    const mem = memoryForContext(session)

    // Do not make the user wait for ledger/continuity/status workers before the
    // decision card becomes available. Errors remain isolated from Phase B/C.
    publishTurnDecision(session, event, snapshot, narrative,signal).catch((error) => {
      ctx.logger?.warn?.(`roleplay: decision card failed: ${String(error)}`)
    })

    const jobs = backgroundMemory ? [] : [
      llmJson(ctx, route, {
        system: LEDGER_WORKER_SYSTEM,
        signal,
        user:
          `既有正史尾部（最近 80 条）：\n${JSON.stringify((mem?.deltas ?? []).slice(-80))}\n\n本轮用户输入：\n${snapshot.userText}\n\n候选正文（已展示给用户的 canonical narrative）：\n${narrative}\n\n请输出正史增量 JSON。`,
        maxTokens: Number(cfg.workerMaxTokens) || 2048,
        temperature: Number(cfg.workerTemperature) ?? 0.4,
        timeoutMs: Number(cfg.phaseBTimeoutMs) || 90000,
      }),
      llmJson(ctx, route, {
        system: CONTINUITY_WORKER_SYSTEM,
        signal,
        user:
          `既有正史（场景 + 最近记忆）：\n${JSON.stringify({
            scene: T.scene.get(keyOf(branchId, 'current')) ?? null,
            summary: mem?.summary ?? '',
            deltas: (mem?.deltas ?? []).slice(-80),
          })}\n\n本轮用户输入：\n${snapshot.userText}\n\n候选正文：\n${narrative}\n\n请输出连续性检查 JSON。`,
        maxTokens: Number(cfg.workerMaxTokens) || 2048,
        temperature: Number(cfg.workerTemperature) ?? 0.4,
        timeoutMs: Number(cfg.phaseBTimeoutMs) || 90000,
      }),
    ]
    // Register this turn in the serial chain before waiting on workers. The next
    // Phase A can now reliably wait for the complete previous-turn commit, and
    // faster later workers cannot overtake an earlier turn.
    const previousCommit = st.commitChain ?? Promise.resolve()
    const currentCommit = (async () => {
      try {
      const [ledger, check] = await awaitTaskAdmissions(jobs)
      // llmJson is intentionally fail-closed and returns null on a transport,
      // timeout, or parse failure.  Do not mark a Phase-B transaction complete
      // with an empty result: keep the snapshot and let the bounded retry path
      // try again instead.
      if (!backgroundMemory && (!ledger || typeof ledger !== 'object' || !check || typeof check !== 'object')) {
        throw new Error('Phase B worker 未返回可提交的结构化结果')
      }
      try {
        await previousCommit
      } catch (error) {
        ctx.logger?.warn?.(`roleplay: previous commit failed: ${String(error)}`)
      }
        if (isStale(session, snapshot, event.seq)) {
          ctx.logger?.warn?.('roleplay: commit skipped — surface changed during turn (stale)')
          return
        }
        const newDeltas = ledger && Array.isArray(ledger.deltas)
          ? ledger.deltas.map((d) => ({
              atSeq: event.seq,
              sessionId: branchId,
              turnId: snapshot.turnId,
              status: d.status === 'uncertain' ? 'uncertain' : 'established',
              type: d.type ?? 'event',
              summary: String(d.summary ?? '').slice(0, 800),
              evidenceSeq: Number.isSafeInteger(d.evidenceSeq) ? d.evidenceSeq : event.seq,
            }))
          : []
        const newConfirmations = check && Array.isArray(check.conflicts)
          ? check.conflicts.map((c) => ({
              atSeq: event.seq,
              sessionId: branchId,
              turnId: snapshot.turnId,
              severity: c.severity ?? 'medium',
              claim: String(c.claim ?? '').slice(0, 600),
              canon: String(c.canon ?? '').slice(0, 600),
              evidenceSeq: Number.isSafeInteger(c.evidenceSeq) ? c.evidenceSeq : event.seq,
            }))
          : []
        const significantConflict = newConfirmations.some((item) =>
          item.severity === 'high' || item.severity === 'medium')
        const memoryKey = keyOf(branchId, 'head')
        if (!backgroundMemory && !T.memory.get(memoryKey)) {
          await T.memory.put(memoryKey, { deltas: [], lockedFacts: [], pendingConfirmations: [], version: 1 })
        }
        if (!backgroundMemory) await T.memory.update(memoryKey, (current) => {
          const priorDeltas = Array.isArray(current?.deltas) ? current.deltas : []
          const priorConfirmations = Array.isArray(current?.pendingConfirmations)
            ? current.pendingConfirmations
            : []
          const hasOrigin = (item) => item && item.sessionId === branchId
            && Number(item.atSeq) === Number(event.seq)
            && Number(item.turnId) === Number(snapshot.turnId)
          const merge = (prior, incoming, limit) => {
            const existing = prior.some(hasOrigin)
            return (existing ? prior : [...prior, ...incoming]).slice(-limit)
          }
          return {
            ...current,
            deltas: merge(priorDeltas, newDeltas, 600),
            pendingConfirmations: merge(priorConfirmations, newConfirmations, 100),
            version: (Number(current?.version) || 1) + 1,
            updatedAtSeq: event.seq,
            sessionId: branchId,
          }
        })

        const pendingScene = st.pendingScenes.get(Number(snapshot.turnId)) ?? st.pendingScene
        if (pendingScene && pendingScene.scene && pendingScene.scene.place) {
          await T.scene.put(keyOf(branchId, 'current'), {
            ...pendingScene.scene,
            updatedAtSeq: event.seq,
            atSeq: event.seq,
            sessionId: branchId,
          })
        }
        st.pendingScenes.delete(Number(snapshot.turnId))
        if (st.pendingTurn === snapshot.turnId) st.pendingScene = null

        const metaKey = keyOf(branchId, 'meta')
        const meta = cloneBranchRecord(T.branch.get(metaKey)) ?? { createdAt: Date.now() }
        await T.branch.put(metaKey, {
          ...meta,
          lastTurn: snapshot.turnId,
          lastSeq: event.seq,
          surfaceTokens: estimateTokens(narrative),
        })
        const activeWindow = contextWindowFor(session)
        if (activeWindow && Number(event.seq) > Number(activeWindow.throughSeq ?? -1)) {
          const windowEntries = surfaceEntries(session).filter((entry) =>
            Number(entry.seq) > Number(activeWindow.startSeq ?? -1))
          await T.branch.put(contextWindowKey(branchId), {
            ...activeWindow,
            throughSeq: Number(event.seq),
            storyTokens: windowEntries.reduce((sum, entry) => sum + estimateTokens(entry.text), 0),
            updatedAt: Date.now(),
          })
        }

        // 重新生成版本的账本登记（本轮的正文即该锚点的新版本）
        if (st.regenerateAnchor !== null) {
          await svc.recordVersion(branchId, st.regenerateAnchor, event.data?.turn, event.seq)
          st.regenerateAnchor = null
        }
        await T.branch.put(phaseKey, {
          ...cloneBranchRecord(T.branch.get(phaseKey)),
          state: 'completed',
          memoryMode: backgroundMemory ? 'background-notes' : 'foreground-ledger',
          completedAt: Date.now(),
          error: null,
        })
        committed = true
        // A continuity conflict invalidates the assumptions behind an
        // incremental director-note checkpoint.  Rebuild from the complete
        // selected branch after the Phase-B transaction is durable; the
        // immutable event log remains the source of truth and the rebuild is
        // deliberately outside the foreground narration path.
        if (significantConflict) {
          // Continuity conflicts invalidate every incremental checkpoint: the
          // next model window must receive a fresh director-note projection
          // over the complete selected branch, not a summary that still
          // points at the contradicted chapter.
          ctx.logger?.warn?.(`roleplay: significant continuity conflict at seq ${event.seq}; rebuilding director notes`)
          const compaction = ctx.get('compaction')
          if (typeof compaction?.rebuildDirectorNotes === 'function') {
            Promise.resolve(compaction.rebuildDirectorNotes({ session }))
              .catch((error) => ctx.logger?.warn?.(`roleplay: conflict director-note rebuild failed: ${String(error)}`))
          }
        }
      } catch (error) {
        if(isInlinePending(error)) {
          await T.branch.put(phaseKey,{...cloneBranchRecord(T.branch.get(phaseKey)),state:'waiting-main',error:null})
          return
        }
        ctx.logger?.warn?.(`roleplay: commit failed: ${String(error)}`)
        await T.branch.put(phaseKey, {
          ...cloneBranchRecord(T.branch.get(phaseKey)),
          state: 'retry',
          error: String(error?.message ?? error).slice(0, 500),
          failedAt: Date.now(),
        }).catch(() => {})
        const attempts = Number(st.phaseBAttempts.get(Number(snapshot.turnId)) || 0) + 1
        st.phaseBAttempts.set(Number(snapshot.turnId), attempts)
        // Keep the snapshot until a retry succeeds. A bounded retry avoids
        // dropping memory/scene updates after one transient storage/provider
        // failure while still preventing an endless restart loop.
        if (attempts <= 3 && !st.phaseBRetryTimers.has(Number(snapshot.turnId)) && !signal?.aborted) {
          const timer = setTimeout(() => {
            st.phaseBRetryTimers.delete(Number(snapshot.turnId))
            if(signal?.aborted)return
            runPhaseBC(session, event, st, snapshot,signal).catch((retryError) => {
              ctx.logger?.warn?.(`roleplay: phase BC retry failed: ${String(retryError)}`)
            })
          }, Math.min(30_000, 2_000 * attempts))
          st.phaseBRetryTimers.set(Number(snapshot.turnId), timer)
        }
      } finally {
        if (committed && st.snapshots.get(Number(snapshot.turnId)) === snapshot) st.snapshots.delete(Number(snapshot.turnId))
        if (st.snapshot === snapshot) st.snapshot = null
        if (committed && Number(st.pendingTurn) === Number(snapshot.turnId)) st.pendingTurn = null
        if (committed) {
          st.phaseBStarted.delete(Number(snapshot.turnId))
          st.phaseBAttempts.delete(Number(snapshot.turnId))
        } else {
          st.phaseBStarted.delete(Number(snapshot.turnId))
        }
      }
    })()
    st.commitChain = currentCommit
    await currentCommit
  }

  function queueCompletedTurn(session, event) {
    if (!event || event.type !== 'turn/end') return
    const turn = Number(event.data?.turn)
    if (!Number.isSafeInteger(turn)) return
    const st = sessions.get(session.id)
    const snapshot = st?.snapshots.get(turn)
    if (!st || !snapshot || st.phaseBStarted.has(turn)) return
    if (event.data?.reason?.kind !== 'completed') {
      st.snapshots.delete(turn)
      st.pendingScenes.delete(turn)
      failPendingNativeFork(session, `turn ${String(turn)} 未以 completed 正常结束`).catch((error) => {
        ctx.logger?.warn?.(`roleplay: failed branch cleanup failed: ${String(error)}`)
      })
      return
    }
    const canonical = canonicalAssistantForTurn(session, turn)
    if (!canonical) {
      st.snapshots.delete(turn)
      st.pendingScenes.delete(turn)
      failPendingNativeFork(session, `turn ${String(turn)} 缺少可见 canonical Agent 回复`).catch((error) => {
        ctx.logger?.warn?.(`roleplay: failed branch cleanup failed: ${String(error)}`)
      })
      return
    }
    st.phaseBStarted.add(turn)
    runPhaseBC(session, canonical, st, snapshot).catch((error) => {
      ctx.logger?.warn?.(`roleplay: phase BC failed (turn ${turn}): ${String(error)}`)
    })
  }

  // `agent/status=idle` is emitted only after the entire inbox drains. A user
  // can queue several roleplay turns in one run, so consume each durable
  // turn/end as its own Phase-B work item instead of retaining one scalar
  // snapshot and silently dropping the earlier turns.
  ctx.on('session/event', (session, event) => {
    // Both consumers below handle turn/end only. Reject token chunks before
    // preset/child detection: that detection reads the complete append-only
    // log and otherwise makes streaming quadratic in the session length.
    if (event?.type !== 'turn/end') return
    if (session && isRoleplaySession(session)) {
      if (isCompletedTurnEnd(event)) {
        const canonical = canonicalAssistantForTurn(session, event.data.turn)
        if (canonical) queueStatusObligation(session, canonical, 'session/event')
      }
      queueCompletedTurn(session, event)
    }
  }, { global: true })

  // 阶段 B/C 触发：standing 挂载的 ctx.on 收不到 session/event（会话事件
  // 只派发给会话 scope 内的监听者），改用 agent 作用域事件 agent/status——
  // 与 agent/pre-step 同机制，已实证可达 standing 挂载。轮次结束时 agent
  // 转为 idle，此时向后扫描日志取本轮最后一条 assistant/message 提交。
  ctx.on('agent/status', (payload) => {
    const agent = payload?.agent
    // agentEvents injects the complete Agent instance. Prefer its authoritative
    // session and keep the session registry lookup only as a compatibility path.
    const session = agent?.session ?? ctx.sessions.get(agent?.id) ?? null
    if (!session || !isRoleplaySession(session)) {
      try { ctx.logger?.warn?.('roleplay: agent/status skipped (session/preset): ' + JSON.stringify({ gotSession: session != null, agentId: agent?.id })) } catch {}
      return
    }
    if (payload?.status === 'running') {
      statusRunStartSeq.set(session.id, lastSeq(session))
      return
    }
    if (payload?.status !== 'idle') return
    // The idle event can be the only reachable completion feed on a standing
    // mount. Drain this run and pending durable work without Phase-A snapshots.
    recoverStatusObligations(session, 'agent/idle', agent)
    statusRunStartSeq.delete(session.id)
    const st = sessions.get(session.id)
    if (!st || (st.pendingTurn === null && st.regenerateAnchor === null && st.snapshots.size === 0)) return
    const log = eventsOf(session)
    let evt = null
    let targetTurn = st.pendingTurn === null ? null : Number(st.pendingTurn)
    if (targetTurn === null) {
      for (let i = log.length - 1; i >= 0; i--) {
        if (log[i]?.type === 'turn/start') {
          targetTurn = Number(log[i].data?.turn)
          break
        }
      }
    }
    if (targetTurn !== null) evt = canonicalAssistantForTurn(session, targetTurn)
    if (!evt) {
      st.pendingTurn = null
      st.snapshot = null
      failPendingNativeFork(session, `turn ${String(targetTurn)} 未以 completed 正常结束`).catch((error) => {
        ctx.logger?.warn?.(`roleplay: failed branch cleanup failed: ${String(error)}`)
      })
      return
    }
    if (st.pendingTurn !== null && !st.phaseBStarted.has(Number(st.pendingTurn))) {
      if (Number(evt.data?.turn) !== Number(st.pendingTurn)) return
      st.pendingTurn = null
      ctx.logger?.warn?.('roleplay: runPhaseBC starting (turn ' + Number(evt.data?.turn) + ', seq ' + evt.seq + ')')
      const queuedSnapshot = st.snapshots.get(Number(evt.data?.turn)) ?? st.snapshot
      if (queuedSnapshot) st.phaseBStarted.add(Number(evt.data?.turn))
      runPhaseBC(session, evt, st, queuedSnapshot).catch((error) => {
        ctx.logger?.warn?.(`roleplay: phase BC failed: ${String(error)}`)
      })
    } else if (st.regenerateAnchor !== null) {
      // 重新生成版本：只登记版本账本，不做正史抽取（备用版本不改记忆；
      // 记忆整理以当前可见表面为准）
      const anchor = st.regenerateAnchor
      st.regenerateAnchor = null
      svc
        .recordVersion(session.id, anchor, evt.data?.turn, evt.seq)
        .catch((error) => {
          ctx.logger?.warn?.(`roleplay: version record failed: ${String(error)}`)
        })
    }
  })

  // ── 分支继承：原生 Session fork 的 seed 只复制会话事件，preset 私有域
  //    需要在子会话首次使用时惰性建立。卡片/规则属于创作配置，按 fork
  //    当下的活动版本继承；记忆/场景/状态属于剧情正史，必须裁到 seedLength，
  //    绝不能把父会话在分叉点之后发生的剧情泄漏到子分支。───────────────

  async function ensureBranch(session, { cadenceAnchorSeq = null, cadenceTurn = null } = {}) {
    const st = ensureState(session.id)
    if (st.branchReady) return
    if (st.branchPreparing) {
      await st.branchPreparing
      return
    }
    st.branchPreparing = (async () => {
      try {
        const parent = session.header?.parentSession
        if (parent) {
            const meta = cloneBranchRecord(T.branch.get(keyOf(session.id, 'meta')))
            // A previous process can die after writing a provisional marker.
            // Existence alone is not an inheritance commit: only the explicit
            // ready marker permits skipping the copy/replay pass.
            const expectedSeedLength = Number.isSafeInteger(session.header?.seedLength)
              ? Number(session.header.seedLength)
              : null
            const inheritanceReady = meta?.inheritanceState === 'ready'
              && String(meta?.inheritedFrom ?? '') === String(parent)
              && (meta?.inheritedAtSeedLength ?? null) === expectedSeedLength
            if (!inheritanceReady) {
            const pPrefix = `${parent}__`
            const cP = `${session.id}__`
            const seedLength = Number.isSafeInteger(session.header?.seedLength)
              ? Number(session.header.seedLength)
              : Number.POSITIVE_INFINITY
            const beforeSeed = (seq) => {
              const value = durableSeq(seq)
              return value !== null && Number.isFinite(seedLength) && value < seedLength
            }
            const beforeSeedRecords = (items) => (Array.isArray(items) ? items : []).filter((item) => {
              if (!item || typeof item !== 'object') return false
              return beforeSeed(provenanceSeq(item))
            })
            const rewrittenCadenceSlot = Number.isSafeInteger(Number(cadenceAnchorSeq))
              && Number.isSafeInteger(Number(cadenceTurn))
              ? { anchorSeq: Number(cadenceAnchorSeq), turn: Number(cadenceTurn) }
              : null

            // 创作配置：fork 后仍应保留同一角色卡、世界书和作者美化；这些
            // 不是剧情正史，不能因从较早轮次分叉而突然消失。
            for (const [k, v] of T.cards.entries()) {
              if (k.startsWith(pPrefix) && v) await T.cards.put(cP + k.slice(pPrefix.length), cloneBranchRecord(v))
            }
            for (const [k, v] of T.worldbook.entries()) {
              if (k.startsWith(pPrefix) && v) await T.worldbook.put(cP + k.slice(pPrefix.length), cloneBranchRecord(v))
            }
            for (const table of [T.rules, T.opening]) {
              for (const [k, v] of table.entries()) {
                if (k.startsWith(pPrefix) && v) await table.put(cP + k.slice(pPrefix.length), cloneBranchRecord(v))
              }
            }
            const parentSettings = T.branch.get(keyOf(parent, 'settings'))
            for(const [k,v] of [...T.branch.entries()])if(k.startsWith(`${parent}__cluster-lore-`)&&Number(v.seq)<Number(seedLength)&&clusterLoreVisible(session,v,Number(seedLength)))
              await T.branch.put(keyOf(session.id,`cluster-lore-${v.seq}`),{...cloneBranchRecord(v),branchId:session.id})
            if (parentSettings) await T.branch.put(keyOf(session.id, 'settings'), cloneBranchRecord(parentSettings))
            const parentWindow = T.branch.get(contextWindowKey(parent))
            if (parentWindow) {
              const inheritedWindow = cloneContextWindow(parentWindow)
              const inheritedStart = Number(inheritedWindow.startSeq ?? -1)
              const seedBoundary = Number.isFinite(seedLength) ? seedLength : Number.POSITIVE_INFINITY
              // A child may fork before the parent's current hard-window
              // boundary. In that case the copied boundary would hide visible
              // seed history, so restart the child at a conservative window 1.
              if (inheritedStart >= seedBoundary) {
                await T.branch.put(contextWindowKey(session.id), {
                  windowNumber: 1, windowId: randomUUID(), previousWindowId: null,
                  branchId: session.id, startSeq: -1, throughSeq: seedBoundary - 1,
                  storyTokens: 0, createdAt: Date.now(), rolloverCount: 0,
                  reason: 'fork-before-parent-window-boundary',
                })
              } else {
                await T.branch.put(contextWindowKey(session.id), {
                  ...inheritedWindow,
                  branchId: session.id,
                  throughSeq: Math.min(Number(inheritedWindow.throughSeq ?? -1), seedBoundary - 1),
                  inheritedFrom: parent,
                  inheritedAtSeedLength: Number.isFinite(seedLength) ? seedLength : null,
                })
              }
            }
            const parentStatusSpec = T.status.get(keyOf(parent, 'spec'))
            if (parentStatusSpec) await T.status.put(keyOf(session.id, 'spec'), cloneBranchRecord(parentStatusSpec))

            // Story-derived memory is fail-closed.  The child surface itself is
            // the only proof that a compacted summary belongs before the fork;
            // legacy fields without a source seq are deliberately not copied.
            const parentMemory = T.memory.get(keyOf(parent, 'head'))
            if (parentMemory) {
              const checkpoint = visibleCompactionCheckpoint(session)
              // Carry only complete, verified prefixes within the native seed.
              // The memory reader still checks every seq + content hash against
              // this child's selected history before exposing or reusing notes.
              const notesInsideSeed=note=>Array.isArray(note?.sourceKeys)&&note.sourceKeys.length>0
                &&note.sourceKeys.every(key=>typeof key==='string'&&/^[0-9]+:[a-f0-9]{64}$/.test(key)&&beforeSeed(Number(key.split(':')[0])))
              const directorCheckpoints=[parentMemory.directorNotes,...(Array.isArray(parentMemory.directorCheckpoints)?parentMemory.directorCheckpoints:[])]
                .filter(note=>note?.validated===true&&notesInsideSeed(note))
                .filter((note,index,all)=>all.findIndex(other=>JSON.stringify(other.sourceKeys)===JSON.stringify(note.sourceKeys))===index)
              const parentCadence = parentMemory.notesCadence
              const parentCadenceSlots = parentCadence?.schemaVersion === 1 && Array.isArray(parentCadence.slots)
                ? parentCadence.slots
                : ctx.get('compaction')?.legacyCadenceSlotsFor?.(ctx.sessions.get(parent), parentMemory) ?? []
              const notesCadence = Array.isArray(parentCadenceSlots)
                ? { schemaVersion: 1, branchId: session.id,
                  slots: parentCadenceSlots.filter(slot => Number.isSafeInteger(slot?.turn)
                    && Number.isSafeInteger(slot?.anchorSeq) && (beforeSeed(slot.anchorSeq)
                      || (rewrittenCadenceSlot !== null && Number(slot.anchorSeq) === rewrittenCadenceSlot.anchorSeq
                        && Number(slot.turn) === rewrittenCadenceSlot.turn))).map(slot => ({
                    turn: Number(slot.turn), anchorSeq: Number(slot.anchorSeq),
                  })),
                  inheritedFrom: parent, inheritedAtSeedLength: Number.isFinite(seedLength) ? seedLength : null,
                  updatedAt: Date.now() }
                : null
              await T.memory.put(keyOf(session.id, 'head'), {
                schemaVersion:1,
                summary: checkpoint?.text ?? '',
                surfaceCheckpointSeq: checkpoint?.seq ?? null,
                lastCompactedSeq: checkpoint?.seq ?? -1,
                archives: beforeSeedRecords(parentMemory.archives),
                archiveDigests: beforeSeedRecords(parentMemory.archiveDigests),
                deltas: beforeSeedRecords(parentMemory.deltas),
                pendingConfirmations: beforeSeedRecords(parentMemory.pendingConfirmations),
                lockedFacts: beforeSeedRecords(parentMemory.lockedFacts),
                styleNotes: beforeSeedRecords(parentMemory.styleNotes),
                userPrefs: beforeSeedRecords(parentMemory.userPrefs),
                directorCheckpoints:cloneBranchRecord(directorCheckpoints),
                ...(notesCadence ? { notesCadence } : {}),
                directorNotes:notesInsideSeed(parentMemory.directorNotes)&&(parentMemory.directorNotes.validated===true||parentMemory.directorNotes.manual===true)
                  ?cloneBranchRecord(parentMemory.directorNotes):null,
                inheritedFrom: parent,
                inheritedAtSeedLength: Number.isFinite(seedLength) ? seedLength : null,
                version: (Number(parentMemory.version) || 1) + 1,
              })
            }

            const parentScene = T.scene.get(keyOf(parent, 'current'))
            if (parentScene && beforeSeed(parentScene.updatedAtSeq ?? parentScene.atSeq)) {
              await T.scene.put(keyOf(session.id, 'current'), cloneBranchRecord(parentScene))
            }
            const parentPanel = T.status.get(keyOf(parent, 'panel'))
            if (parentPanel && beforeSeed(parentPanel.atSeq ?? parentPanel.updatedAtSeq)) {
              await T.status.put(keyOf(session.id, 'panel'), cloneBranchRecord(parentPanel))
            }
            // 待选择决策属于父分支的下一步 UI，不继承到已经开始重生/编辑的
            // 子分支；子分支正文落定后 Phase B 会生成自己的决策卡。
            for (const [k, v] of T.rolls.entries()) {
              if (!k.startsWith(pPrefix) || !v) continue
              const filtered = rollLogEntries(v).filter((item) => beforeSeed(item?.atSeq ?? item?.seq))
              if (filtered.length) {
                await T.rolls.put(cP + k.slice(pPrefix.length), rollLogRecord(filtered))
              }
            }
            const parentImport = T.branch.get(importActiveKey(parent))
            if (parentImport) {
              await T.branch.put(importActiveKey(session.id), {
                ...cloneBranchRecord(parentImport),
                inheritedFrom: parent,
                sourceRecordSessionId: parentImport.sourceRecordSessionId ?? parent,
              })
            }
            // Meta is the inheritance commit marker and MUST be last.  All
            // earlier copies are idempotent, so a failed attempt can replay;
            // publishing meta first would make a half-inherited child look ready.
            await T.branch.put(keyOf(session.id, 'meta'), {
              createdAt: Date.now(),
              lastTurn: 0,
              lastSeq: -1,
              inheritedFrom: parent,
              inheritedAtSeedLength: Number.isFinite(seedLength) ? seedLength : null,
              inheritanceState: 'ready',
            })
          }
        } else if (!T.branch.get(keyOf(session.id, 'meta'))) {
          await T.branch.put(keyOf(session.id, 'meta'), { createdAt: Date.now(), lastTurn: 0, lastSeq: -1 })
        }
        // Native cloning copies a parent's durable panel, including its owner.
        // Rebind only an unchanged, proven prefix within this child's seed.
        // Also repairs ready records written by versions that copied the row
        // verbatim; no model call or parent-state mutation is needed.
        const inheritedPanel = T.status.get(keyOf(session.id, 'panel'))
        if (parent && inheritedPanel?.sessionId === parent && inheritedPanel.provenance && !inheritedPanel.stale
          && Number.isSafeInteger(session.header?.seedLength) && inheritedPanel.atSeq < session.header.seedLength) {
          const event = eventsOf(session).find(item => item.seq === inheritedPanel.atSeq)
          const source = statusSource(session, event)
          const history = (ctx.get('compaction')?.storyEvidence?.(session) ?? surfaceEntries(session))
            .map(entry => ({ seq: entry.seq, role: entry.role ?? entry.kind, text: entry.text }))
            .filter(entry => entry.seq <= inheritedPanel.atSeq)
          const proof = inheritedPanel.provenance
          if (source && source.sourceHash === proof.sourceHash
            && recordSha256(source.sourceSeqs) === recordSha256(proof.sourceSeqs)
            && typeof proof.historyHash === 'string' && recordSha256(history) === proof.historyHash) {
            const fixed = statusFixedContext(session)
            const asParent = { ...fixed, cards: fixed.cards.map(entry => ({ ...entry, key: `${parent}__${entry.key.slice(session.id.length + 2)}` })),
              worldbook: fixed.worldbook.map(entry => ({ ...entry, key: `${parent}__${entry.key.slice(session.id.length + 2)}` })) }
            await T.status.put(keyOf(session.id, 'panel'), { ...cloneBranchRecord(inheritedPanel), sessionId: session.id, branchId: session.id,
              provenance: { ...cloneBranchRecord(proof), ...(recordSha256(asParent) === proof.fixedContextHash
                ? { fixedContextHash: recordSha256(fixed) } : {}) } })
          }
        }
        st.branchReady = true
      } catch (error) {
        ctx.logger?.warn?.(`roleplay: branch inherit failed for ${session.id}: ${String(error)}`)
        st.branchReady = false
        throw error
      } finally {
        st.branchPreparing = null
      }
    })()
    await st.branchPreparing
  }

  // ── 原生 Session 分支索引 ────────────────────────────────────────────────
  // 每个候选回复都是一个独立 Session；分支分页只保存很小的导航元数据，
  // 不复制兄弟分支正文。Harness 因而仍按当前 Session 尾页懒加载，模型、
  // 世界书检索和记忆也天然只看到当前选择的正史。

  const forkGroupKey = (groupId) => `fork-group-${safeId(groupId)}`
  const forkOperationKey = (operationId) => `fork-op-${safeId(operationId)}`
  const forkAnchorKey = (sessionId, messageId) => keyOf(sessionId, `fork-anchor-${sha256(messageId).slice(0, 24)}`)
  const forkPendingKey = (sessionId, groupId) => keyOf(sessionId, `fork-pending-${safeId(groupId)}`)
  const editInvalidationKey = (sessionId, role, replacementSeq) =>
    keyOf(sessionId, `edit-invalidated-${role}-${safeId(replacementSeq)}`)
  const playerProjectionKey = (sessionId, groupId, playerVariantId) =>
    keyOf(sessionId, `player-projection-${sha256(`${groupId}\0${playerVariantId}`).slice(0, 32)}`)
  const forkAnchorLockKey = (anchor) => {
    const sourceId = String(anchor?.sourceSessionId ?? '')
    const messageId = String(anchor?.sourceAssistantMessageId ?? '')
    return `anchor:${sourceId}:${sha256(messageId).slice(0, 24)}`
  }
  const forkGroupLockKey = (groupId) => {
    const group = hydrateForkGroup(T.branch.get(forkGroupKey(groupId)))
    return group?.anchor ? forkAnchorLockKey(group.anchor) : `group:${safeId(groupId)}`
  }
  const forkMutationLocks = new Map()

  async function withForkMutationLock(key, work) {
    const prior = forkMutationLocks.get(key) ?? Promise.resolve()
    let release
    const gate = new Promise((resolveGate) => { release = resolveGate })
    const queued = prior.catch(() => {}).then(() => gate)
    forkMutationLocks.set(key, queued)
    await prior.catch(() => {})
    try {
      return await work()
    } finally {
      release()
      if (forkMutationLocks.get(key) === queued) forkMutationLocks.delete(key)
    }
  }

  function visibleSeqSet(session) {
    const nodes = session?.surface?.nodes
    return nodes && typeof nodes[Symbol.iterator] === 'function'
      ? new Set(Array.from(nodes, Number).filter(Number.isSafeInteger))
      : new Set()
  }

  function assistantMessageId(event) {
    const value = event?.data?.message?.id ?? event?.data?.messageId
    return value === undefined || value === null ? '' : String(value)
  }

  function completedTurns(session) {
    return new Set(eventsOf(session)
      .filter(isCompletedTurnEnd)
      .map((event) => Number(event.data?.turn))
      .filter(Number.isSafeInteger))
  }

  function turnForEvent(session, event) {
    const limit = Number(event?.seq)
    if (!Number.isSafeInteger(limit)) return null
    for (let index = Math.min(limit, eventsOf(session).length - 1); index >= 0; index -= 1) {
      const candidate = eventsOf(session)[index]
      if (candidate?.type === 'turn/start' && Number.isSafeInteger(Number(candidate.data?.turn))) {
        return Number(candidate.data.turn)
      }
    }
    return null
  }

  function requestUserEvent(session, requestId) {
    if (typeof requestId !== 'string' || !requestId) return null
    return [...surfaceEvents(session)].reverse().find((event) =>
      event?.type === 'user/message' &&
      event.data?.source?.kind === 'user' &&
      String(event.data?.source?.rpcId ?? '') === requestId) ?? null
  }

  function currentSurfaceUserBefore(session, assistantEvent) {
    const surface = surfaceEvents(session)
    const assistantIndex = surface.findIndex((event) => Number(event?.seq) === Number(assistantEvent?.seq))
    if (assistantIndex < 0) return null
    for (let index = assistantIndex - 1; index >= 0; index -= 1) {
      const event = surface[index]
      if (event?.type !== 'user/message' || event.data?.source?.kind !== 'user') continue
      const text = textOf(event.data?.content).trim()
      if (text) return { event, text }
    }
    return null
  }

  function hydrateForkGroup(value) {
    if (!value || typeof value !== 'object') return null
    const group = cloneBranchRecord(value)
    group.schemaVersion = 2
    group.members = Array.isArray(group.members) ? group.members : []
    group.playerVariants = group.playerVariants && typeof group.playerVariants === 'object' && !Array.isArray(group.playerVariants)
      ? group.playerVariants
      : {}
    const ordered = [...group.members].sort((a, b) => Number(a?.ordinal) - Number(b?.ordinal))
    let nextPlayerOrdinal = 1
    let inheritedVariant = `${group.groupId}:player:1`
    const ordinalByVariant = new Map()
    for (const [index, member] of ordered.entries()) {
      const startsNewPlayerVariant = index > 0 && (
        member.kind === 'edit' || member.kind === 'player-edit' || member.kind === 'player-edit-send'
      )
      if (!member.playerVariantId) {
        if (startsNewPlayerVariant) inheritedVariant = `${group.groupId}:player:${++nextPlayerOrdinal}`
        member.playerVariantId = inheritedVariant
      }
      if (!ordinalByVariant.has(member.playerVariantId)) {
        const preferred = Number(member.playerOrdinal)
        const ordinal = Number.isSafeInteger(preferred) && preferred > 0
          ? preferred
          : ordinalByVariant.size + 1
        ordinalByVariant.set(member.playerVariantId, ordinal)
      }
      member.playerOrdinal = ordinalByVariant.get(member.playerVariantId)
      nextPlayerOrdinal = Math.max(nextPlayerOrdinal, Number(member.playerOrdinal) || 1)
      const variant = group.playerVariants[member.playerVariantId]
      if (!variant || typeof variant !== 'object') {
        group.playerVariants[member.playerVariantId] = {
          text: String(member.promptText ?? group.anchor?.promptText ?? ''),
          revision: Math.max(1, Number(member.playerTextRevision) || 1),
          updatedAt: Number(member.editedAt ?? member.createdAt ?? group.updatedAt ?? Date.now()),
        }
      }
      member.playerTextRevision = Math.max(1, Number(member.playerTextRevision) || Number(group.playerVariants[member.playerVariantId]?.revision) || 1)
      if (member.playerAppliedRevision === undefined && member.userMessageId) {
        member.playerAppliedRevision = member.playerTextRevision
      }
      if (!member.userMessageId && member.sessionId === group.rootSessionId) {
        member.userMessageId = String(group.anchor?.sourceUserMessageId ?? '') || null
        member.userSeq = Number.isSafeInteger(Number(group.anchor?.sourceUserSeq))
          ? Number(group.anchor.sourceUserSeq)
          : null
      }
    }
    group.members = ordered
    return group
  }

  function sessionLineageIds(session) {
    const ids = []
    let current = session
    for (let depth = 0; current && depth < 64; depth += 1) {
      ids.push(current.id)
      const parentId = current.header?.parentSession
      if (!parentId) break
      current = ctx.sessions.get(parentId)
    }
    return ids
  }

  function buildForkLookupIndex() {
    const bySessionMessage = new Map()
    const groups = []
    for (const [key, raw] of T.branch.entries()) {
      if (!String(key).startsWith('fork-group-')) continue
      const group = hydrateForkGroup(raw)
      if (!group) continue
      groups.push(group)
      for (const member of group.members) {
        if (!member.deleted && member.sessionId && member.assistantMessageId) {
          bySessionMessage.set(`${member.sessionId}\0${member.assistantMessageId}`, group.groupId)
        }
      }
    }
    return { bySessionMessage, groups }
  }

  function forkPointerFor(session, messageId, lookup = null) {
    const lineage = sessionLineageIds(session)
    for (const sessionId of lineage) {
      const pointer = T.branch.get(forkAnchorKey(sessionId, messageId))
      if (pointer?.groupId) return pointer
    }
    if (lookup?.bySessionMessage instanceof Map) {
      for (const sessionId of lineage) {
        const groupId = lookup.bySessionMessage.get(`${sessionId}\0${messageId}`)
        if (groupId) return { groupId, recovered: true }
      }
      return null
    }
    // Recover an interrupted "group committed, child pointer not yet written"
    // transaction from the small navigation ledger. This also ensures every
    // descendant regeneration resolves the canonical root-anchor lock.
    for (const [key, raw] of T.branch.entries()) {
      if (!String(key).startsWith('fork-group-')) continue
      const group = hydrateForkGroup(raw)
      if (group?.members?.some((member) =>
        !member.deleted && lineage.includes(member.sessionId) && member.assistantMessageId === messageId)) {
        return { groupId: group.groupId, recovered: true }
      }
    }
    return null
  }

  function groupMemberForSession(group, session, messageId, { includeDeleted = false } = {}) {
    for (const sessionId of sessionLineageIds(session)) {
      const member = group?.members?.find((item) =>
        (includeDeleted || !item.deleted) && item.sessionId === sessionId && item.assistantMessageId === messageId)
      if (member) return member
    }
    return null
  }

  function locateForkTarget(session, requestedMessageId) {
    const events = eventsOf(session)
    const wanted = String(requestedMessageId ?? '')
    const currentAssistant = [...surfaceEvents(session)].reverse().find((event) =>
      event?.type === 'assistant/message' && assistantMessageId(event) === wanted)
    let assistantIndex = currentAssistant ? Number(currentAssistant.seq) : -1
    if (assistantIndex < 0) {
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index]
        if (event?.type === 'assistant/message' && assistantMessageId(event) === wanted) {
          assistantIndex = index
          break
        }
      }
    }
    if (assistantIndex < 0) throw new Error('目标回复不存在或尚未落盘')
    if (internalTaskSeqs(session).has(assistantIndex)) throw Object.assign(new Error('该消息属于系统维护，请从对应剧情正文重新生成'),{code:'ROLEPLAY_NOT_STORY'})
    const assistant = events[assistantIndex]

    // 正常回复的玩家输入与 assistant 在同一 turn；兼容旧版 /regenerate
    // 产生的“仅插件 steering、没有玩家消息”的伪分支：向前回溯最近一次真实
    // 玩家输入，并从那一轮之前重新建立原生分支。
    let currentTurn = null
    const userCandidates = []
    for (let index = 0; index <= assistantIndex; index += 1) {
      const event = events[index]
      if (event?.type === 'turn/start') currentTurn = Number(event.data?.turn)
      if (event?.type !== 'user/message' || event.data?.source?.kind !== 'user') continue
      const text = textOf(event.data?.content).trim()
      if (!text) continue
      userCandidates.push({ event, text, turn: currentTurn, index })
    }
    const assistantTurn = Number(assistant.data?.turn)
    const surfaceUser = currentSurfaceUserBefore(session, assistant)
    const user = surfaceUser
      ? {
          event: surfaceUser.event,
          text: surfaceUser.text,
          turn: assistantTurn,
          index: Number(surfaceUser.event.seq),
        }
      : [...userCandidates].reverse().find((entry) => Number(entry.turn) === assistantTurn)
        ?? userCandidates.at(-1)
    if (!user) throw new Error('目标回复之前找不到真实玩家消息，无法安全重建分支')

    let turnStartIndex = -1
    for (let index = Math.min(user.index, events.length - 1); index >= 0; index -= 1) {
      if (events[index]?.type === 'turn/start' && Number(events[index]?.data?.turn) === Number(user.turn)) {
        turnStartIndex = index
        break
      }
    }
    let previousTurnEndSeq = null
    for (let index = turnStartIndex - 1; index >= 0; index -= 1) {
      if (events[index]?.type === 'turn/end') {
        previousTurnEndSeq = Number(events[index].seq)
        break
      }
    }
    return {
      sourceSessionId: session.id,
      sourceAssistantMessageId: wanted,
      sourceAssistantSeq: Number(assistant.seq),
      sourceAssistantTurn: assistantTurn,
      sourceUserMessageId: String(user.event.data?.id ?? ''),
      sourceUserSeq: Number(user.event.seq),
      sourceTurn: Number(user.turn),
      previousTurnEndSeq,
      // Native fork includes inter-turn metadata through (but not including)
      // the next turn/start, not only the turn/end event itself.
      expectedSeedLength: previousTurnEndSeq === null ? 0 : (() => {
        let cut = previousTurnEndSeq + 1
        while (cut < events.length && events[cut]?.type !== 'turn/start') cut += 1
        return cut
      })(),
      promptText: user.text,
    }
  }

  async function copyStaticBranchConfig(sourceId, childId) {
    const sourcePrefix = `${sourceId}__`
    const childPrefix = `${childId}__`
    for (const table of [T.cards, T.worldbook, T.rules, T.opening]) {
      for (const [key, value] of table.entries()) {
        if (key.startsWith(sourcePrefix) && value) {
          await table.put(childPrefix + key.slice(sourcePrefix.length), cloneBranchRecord(value))
        }
      }
    }
    const settings = T.branch.get(keyOf(sourceId, 'settings'))
    if (settings) await T.branch.put(keyOf(childId, 'settings'), cloneBranchRecord(settings))
    const statusSpec = T.status.get(keyOf(sourceId, 'spec'))
    if (statusSpec) await T.status.put(keyOf(childId, 'spec'), cloneBranchRecord(statusSpec))
    const activeImport = T.branch.get(importActiveKey(sourceId))
    if (activeImport) {
      await T.branch.put(importActiveKey(childId), {
        ...cloneBranchRecord(activeImport),
        inheritedFrom: sourceId,
        sourceRecordSessionId: activeImport.sourceRecordSessionId ?? sourceId,
      })
    }
  }

  async function bootstrapChildBranch(operation, child) {
    const source = await resolveRoleplaySession(operation.anchor.sourceSessionId)
    if (!source || !child || !isRoleplaySession(child)) {
      throw new Error('源会话或新分支不是可用的角色扮演会话')
    }
    if (child.id === source.id) throw new Error('新分支不能复用源会话')
    const isNativeFork = child.header?.parentSession === source.id
    const isFreshFirstTurn = !child.header?.parentSession && operation.anchor.previousTurnEndSeq === null
    if (!isNativeFork && !isFreshFirstTurn) throw new Error('新会话与分支锚点不匹配')
    if (isNativeFork) {
      const expectedSeedLength = Number(operation.anchor.expectedSeedLength ?? (Number(operation.anchor.previousTurnEndSeq) + 1))
      const actualSeedLength = Number(child.header?.seedLength)
      if (!Number.isSafeInteger(expectedSeedLength) || !Number.isSafeInteger(actualSeedLength)
        || actualSeedLength !== expectedSeedLength) {
        throw new Error('新分支的 seed 边界与操作锚点不一致')
      }
    }
    if (isFreshFirstTurn) {
      const setupOnly = new Set(['session/end-seed', 'session/title', 'model/selection', 'agent-preset/selected', 'permission/preset', 'sandbox/mode', 'approval/policy'])
      if (eventsOf(child).some((event) => !setupOnly.has(event?.type)) || (child.surface?.nodes?.length ?? 0) > 0) {
        throw new Error('首轮分支必须从空白会话创建')
      }
      const existingMembership = [...T.branch.entries()].some(([key, value]) => {
        if (key === forkOperationKey(operation.operationId)) return false
        return value && typeof value === 'object' && (
          value.childSessionId === child.id ||
          value.sessionId === child.id ||
          value.members?.some?.((member) => member?.sessionId === child.id)
        )
      })
      if (existingMembership) throw new Error('首轮分支会话已经绑定其他分支操作')
      await copyStaticBranchConfig(source.id, child.id)
      await T.branch.put(keyOf(child.id, 'meta'), {
        createdAt: Date.now(), lastTurn: 0, lastSeq: -1,
        freshBranchFrom: source.id, inheritedAtSeedLength: 0,
      })
      ensureState(child.id).branchReady = true
    } else {
      await ensureBranch(child, { cadenceAnchorSeq: operation.anchor.sourceUserSeq, cadenceTurn: operation.anchor.sourceTurn })
    }
    return source
  }

  async function registerNativeFork(operation, child, lockAttempt = 0) {
    const messageId = operation.anchor.sourceAssistantMessageId
    const sourceHint = await resolveRoleplaySession(operation.anchor.sourceSessionId)
    const pointerHint = sourceHint ? forkPointerFor(sourceHint, messageId) : null
    const groupHint = pointerHint?.groupId
      ? hydrateForkGroup(T.branch.get(forkGroupKey(pointerHint.groupId)))
      : null
    // Once a reply belongs to a group, every descendant's messageId must use
    // the original group's anchor lock. Two simultaneous regenerations from
    // different child Sessions otherwise hold different locks and overwrite
    // the same member array.
    const lockKey = groupHint?.anchor
      ? forkAnchorLockKey(groupHint.anchor)
      : forkAnchorLockKey(operation.anchor)
    let retryWithCanonicalLock = false

    const result = await withForkMutationLock(lockKey, async () => {
      const liveOperation = cloneBranchRecord(T.branch.get(forkOperationKey(operation.operationId)))
      if (liveOperation?.abortedAt || liveOperation?.state === 'aborted') {
        throw new Error('分支操作已被客户端撤销')
      }
      const source = await resolveRoleplaySession(operation.anchor.sourceSessionId)
      if (!source) throw new Error('源角色扮演会话不存在或无法恢复')
      const livePointer = forkPointerFor(source, messageId)
      const deterministicGroupId = `g-${sha256(`${source.id}\0${messageId}`).slice(0, 32)}`
      let groupId = livePointer?.groupId ?? deterministicGroupId
      let group = hydrateForkGroup(T.branch.get(forkGroupKey(groupId)))
      const canonicalLockKey = group?.anchor ? forkAnchorLockKey(group.anchor) : lockKey
      if (canonicalLockKey !== lockKey) {
        retryWithCanonicalLock = true
        return null
      }
      await bootstrapChildBranch(operation, child)
      if (!group) {
        group = {
          schemaVersion: 2,
          groupId,
          rootSessionId: source.id,
          anchor: operation.anchor,
          members: [{
            sessionId: source.id,
            ordinal: 1,
            kind: 'original',
            promptText: operation.anchor.promptText,
            userMessageId: operation.anchor.sourceUserMessageId,
            userSeq: operation.anchor.sourceUserSeq,
            playerVariantId: `${groupId}:player:1`,
            playerOrdinal: 1,
            assistantMessageId: messageId,
            assistantSeq: operation.anchor.sourceAssistantSeq,
            createdAt: Date.now(),
            deleted: false,
            pending: false,
          }],
          playerVariants: {
            [`${groupId}:player:1`]: {
              text: operation.anchor.promptText,
              revision: 1,
              updatedAt: Date.now(),
            },
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        // Group first, pointer second: an interrupted write can leave only a
        // deterministic orphan, which the same operation safely reuses.
        await T.branch.put(forkGroupKey(groupId), group)
      }
      // Recover the deterministic anchor pointer if a previous crash persisted
      // the group but stopped before the second write.  This is deliberately
      // idempotent and stays inside the same anchor lock.
      const anchorKey = forkAnchorKey(source.id, messageId)
      const anchorPointer = T.branch.get(anchorKey)
      if (anchorPointer?.groupId !== groupId) await T.branch.put(anchorKey, { groupId })

      const existing = group.members.find((member) => member.operationId === operation.operationId)
      if (existing) {
        if (existing.sessionId !== child.id || String(existing.requestId ?? '') !== String(operation.requestId ?? '')) {
          throw new Error('同一分支操作已登记到不同的会话或请求')
        }
        if (existing.pending) {
          await T.branch.put(forkPendingKey(child.id, group.groupId), {
            groupId: group.groupId,
            ordinal: existing.ordinal,
            operationId: operation.operationId,
            requestId: operation.requestId,
            createdAt: existing.createdAt,
          })
        }
        const active = group.members.filter((member) => !member.deleted)
        return {
          groupId: group.groupId,
          ordinal: existing.ordinal,
          total: active.length,
          playerOrdinal: existing.playerOrdinal,
          playerTotal: new Set(active.map((member) => member.playerVariantId)).size,
        }
      }

      const sourceMember = groupMemberForSession(group, source, messageId)
      const exactSourceMember = group.members.find((member) =>
        member.sessionId === source.id && member.assistantMessageId === messageId)
      if (exactSourceMember?.deleted) throw new Error('当前回复版本已删除，不能从旧页面继续创建分支')
      if (!sourceMember) throw new Error('当前回复不属于这个分支组的活动版本，请刷新后重试')
      const ordinal = Math.max(0, ...group.members.map((member) => Number(member.ordinal) || 0)) + 1
      const playerVariants = new Set(group.members.filter((member) => !member.deleted).map((member) => member.playerVariantId))
      const createsPlayerVariant = operation.kind === 'player-edit' || operation.kind === 'player-edit-send' || operation.kind === 'edit'
      const playerOrdinal = createsPlayerVariant
        ? Math.max(0, ...group.members.map((member) => Number(member.playerOrdinal) || 0)) + 1
        : Number(sourceMember?.playerOrdinal) || 1
      const playerVariantId = createsPlayerVariant
        ? `${group.groupId}:player:${randomUUID()}`
        : String(sourceMember?.playerVariantId ?? `${group.groupId}:player:1`)
      if (createsPlayerVariant) {
        group.playerVariants[playerVariantId] = {
          text: operation.promptText,
          revision: 1,
          updatedAt: Date.now(),
        }
      } else {
        const canonical = group.playerVariants[playerVariantId]
        if (canonical && String(canonical.text ?? '') !== String(operation.promptText ?? '')) {
          throw new Error('玩家消息已在其他分支修改，请刷新后重新生成')
        }
      }
      const member = {
        operationId: operation.operationId,
        requestId: operation.requestId,
        sessionId: child.id,
        ordinal,
        kind: operation.kind,
        promptText: operation.promptText,
        userMessageId: null,
        userSeq: null,
        playerVariantId,
        playerOrdinal,
        playerTextRevision: Number(group.playerVariants[playerVariantId]?.revision) || 1,
        playerAppliedRevision: 0,
        assistantMessageId: null,
        assistantSeq: null,
        createdAt: Date.now(),
        deleted: false,
        pending: true,
      }
      group.members.push(member)
      group.updatedAt = Date.now()
      await T.branch.put(forkGroupKey(group.groupId), group)
      await T.branch.put(forkPendingKey(child.id, group.groupId), {
        groupId: group.groupId,
        ordinal,
        operationId: operation.operationId,
        requestId: operation.requestId,
        createdAt: member.createdAt,
      })
      return {
        groupId: group.groupId,
        ordinal,
        total: group.members.filter((candidate) => !candidate.deleted).length,
        playerOrdinal,
        playerTotal: playerVariants.size + (createsPlayerVariant ? 1 : 0),
      }
    })
    if (retryWithCanonicalLock) {
      if (lockAttempt >= 4) throw new Error('分支组在并发登记期间持续变化，请重试')
      return registerNativeFork(operation, child, lockAttempt + 1)
    }
    return result
  }

  function failedForkMembership(session, userEvent, lookup = buildForkLookupIndex()) {
    const requestId=String(userEvent?.data?.source?.rpcId??'')
    const matches=lookup.groups.flatMap(group=>group.members.filter(member=>member.sessionId===session.id)
      .map(member=>({group,member})))
    const exact=matches.filter(({member})=>(requestId&&member.requestId===requestId)||
      (userEvent?.data?.id&&member.userMessageId===userEvent.data.id))
    if(exact.length===1)return exact[0]
    // Some old forks used a different transport ID when submitting the first
    // post-seed input. Their explicit child membership is still authoritative
    // for navigation, but never binds an arbitrary later reply to that fork.
    const seed=durableSeq(session.header?.seedLength)
    if(!session.header?.parentSession||seed===null)return null
    const first=surfaceEvents(session).find(event=>event.seq>=seed&&event.type==='user/message'&&event.data?.source?.kind==='user')
    if(first?.seq!==userEvent?.seq)return null
    const unresolved=matches.filter(({member})=>!member.assistantMessageId&&(member.pending||member.failed)&&
      (!member.deleted||member.failed&&member.failureReason!=='客户端放弃等待'))
    return unresolved.length===1?unresolved[0]:null
  }

  function isRecoverySourceMember(member, anchor, userEvent) {
    if (!member || member.sessionId !== anchor?.sourceSessionId) return false
    if (Number.isSafeInteger(Number(anchor?.sourceUserSeq)) && Number(member.userSeq) === Number(anchor.sourceUserSeq)) return true
    if (anchor?.sourceUserMessageId && String(member.userMessageId ?? '') === String(anchor.sourceUserMessageId)) return true
    const requestId = String(userEvent?.data?.source?.rpcId ?? '')
    return Boolean(requestId && String(member.requestId ?? '') === requestId)
  }

  async function backfillRecoverySourceMember(anchor) {
    const source = await resolveRoleplaySession(anchor?.sourceSessionId)
    if (!source) return false
    let recovery
    try { recovery = locatePlayerRecoveryTarget(source, anchor.sourceUserSeq) } catch { return false }
    if (!recovery
      || recovery.sourceSessionId !== anchor.sourceSessionId
      || Number(recovery.sourceUserSeq) !== Number(anchor.sourceUserSeq)
      || String(recovery.sourceUserMessageId ?? '') !== String(anchor.sourceUserMessageId ?? '')
      || String(recovery.promptText ?? '') !== String(anchor.promptText ?? '')) return false
    const candidates = [...T.branch.entries()]
      .filter(([key, value]) => String(key).startsWith('fork-group-')
        && value?.anchor?.recoveryOnly === true
        && value.anchor.sourceSessionId === anchor.sourceSessionId
        && Number(value.anchor.sourceUserSeq) === Number(anchor.sourceUserSeq))
      .map(([, value]) => hydrateForkGroup(value)).filter(Boolean)
    if (candidates.length !== 1) return false
    const groupId = candidates[0].groupId
    return withForkMutationLock(forkGroupLockKey(groupId), async () => {
      const group = hydrateForkGroup(T.branch.get(forkGroupKey(groupId)))
      const userEvent = userForkContext(source, anchor.sourceUserSeq).event
      if (!group || group.members.some(member => isRecoverySourceMember(member, anchor, userEvent))) return false
      const sameText = Object.entries(group.playerVariants)
        .find(([, variant]) => String(variant?.text ?? '') === String(recovery.promptText ?? ''))
      const playerVariantId = sameText?.[0] ?? `${groupId}:player:recovery-original`
      if (!sameText) group.playerVariants[playerVariantId] = { text: recovery.promptText, revision: 1, updatedAt: Date.now() }
      const playerOrdinal = sameText
        ? Math.max(1, ...group.members.filter(member => member.playerVariantId === playerVariantId).map(member => Number(member.playerOrdinal) || 1))
        : Math.max(0, ...group.members.map(member => Number(member.playerOrdinal) || 0)) + 1
      group.members.push({
        sessionId: anchor.sourceSessionId, ordinal: 0, kind: 'original', promptText: recovery.promptText,
        userMessageId: anchor.sourceUserMessageId, userSeq: anchor.sourceUserSeq,
        playerVariantId, playerOrdinal, playerTextRevision: 1, playerAppliedRevision: 1,
        assistantMessageId: null, assistantSeq: null, createdAt: Date.now(),
        deleted: false, pending: false, failed: true, failureReason: '原始失败轮次',
      })
      group.updatedAt = Date.now()
      await T.branch.put(forkGroupKey(groupId), group)
      return true
    })
  }

  async function registerRecoveryFork(operation, child) {
    const anchor = operation.anchor
    const source = await resolveRoleplaySession(anchor.sourceSessionId)
    let recovery = null
    if (source) {
      try {
        const current = locatePlayerRecoveryTarget(source, anchor.sourceUserSeq)
        if (current
          && current.sourceSessionId === anchor.sourceSessionId
          && Number(current.sourceUserSeq) === Number(anchor.sourceUserSeq)
          && String(current.sourceUserMessageId ?? '') === String(anchor.sourceUserMessageId ?? '')
          && String(current.promptText ?? '') === String(anchor.promptText ?? '')) recovery = current
      } catch {}
    }
    if (!recovery) throw new Error('原始失败轮次已变更、删除或仍在运行，不能登记恢复分支')
    const sourceEvent = userForkContext(source, anchor.sourceUserSeq).event
    const membership=source&&recovery
      ?failedForkMembership(source,sourceEvent):null
    const lockKey = membership?forkGroupLockKey(membership.group.groupId):`recovery:${anchor.sourceSessionId}:${Number(anchor.sourceUserSeq)}`
    return withForkMutationLock(lockKey, async () => {
      await bootstrapChildBranch(operation, child)
      const groupId = membership?.group.groupId??`g-recovery-${sha256(`${anchor.sourceSessionId}\0${anchor.sourceUserSeq}`).slice(0, 32)}`
      let group = hydrateForkGroup(T.branch.get(forkGroupKey(groupId)))
      const originalMember = (ordinal, playerVariantId, playerOrdinal) => ({
        sessionId: anchor.sourceSessionId,
        ordinal,
        kind: 'original',
        promptText: recovery.promptText,
        userMessageId: anchor.sourceUserMessageId,
        userSeq: anchor.sourceUserSeq,
        playerVariantId,
        playerOrdinal,
        playerTextRevision: 1,
        playerAppliedRevision: 1,
        assistantMessageId: null,
        assistantSeq: null,
        createdAt: Date.now(),
        deleted: false,
        pending: false,
        failed: true,
        failureReason: '原始失败轮次',
      })
      if (!group) {
        const playerVariantId = `${groupId}:player:1`
        group = {
          schemaVersion: 2,
          groupId,
          rootSessionId: anchor.sourceSessionId,
          anchor,
          members: [originalMember(1, playerVariantId, 1)],
          playerVariants: { [playerVariantId]: { text: recovery.promptText, revision: 1, updatedAt: Date.now() } },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      }
      // Older recovery groups recorded only the replay child.  Add the source
      // only when the selected failure is still proven on its live surface;
      // ordinal zero places it before legacy entries without renumbering them.
      // `membership` is also proof that the current source is already a
      // member, even if an old record lost its request identity.  Do not add
      // a second ordinal-zero copy merely because it is not kind "original".
      const hasSource = Boolean(membership?.member) || group.members.some(member => isRecoverySourceMember(member, anchor, sourceEvent))
      if (!hasSource && recovery) {
        const sameText = Object.entries(group.playerVariants)
          .find(([, variant]) => String(variant?.text ?? '') === String(recovery.promptText ?? ''))
        const playerVariantId = `${groupId}:player:recovery-original`
        const originalVariantId = sameText?.[0] ?? playerVariantId
        if (!sameText) group.playerVariants[originalVariantId] = { text: recovery.promptText, revision: 1, updatedAt: Date.now() }
        const originalPlayerOrdinal = sameText
          ? Math.max(1, ...group.members.filter(member => member.playerVariantId === originalVariantId).map(member => Number(member.playerOrdinal) || 1))
          : Math.max(0, ...group.members.map(member => Number(member.playerOrdinal) || 0)) + 1
        group.members.push(originalMember(0, originalVariantId, originalPlayerOrdinal))
      }
      const existing = group.members.find((member) => member.operationId === operation.operationId)
      if (existing) {
        if (!existing.deleted && recovery) {
          group.updatedAt = Date.now()
          await T.branch.put(forkGroupKey(groupId), group)
        }
        return { groupId, ordinal: existing.ordinal, total: group.members.filter((m) => !m.deleted).length, playerOrdinal: existing.playerOrdinal, playerTotal: new Set(group.members.filter((m) => !m.deleted).map(member => member.playerVariantId)).size }
      }
      const ordinal = Math.max(0, ...group.members.map((member) => Number(member.ordinal) || 0)) + 1
      const previousMember=membership?group.members.find(member=>member.sessionId===source.id&&member.ordinal===membership.member.ordinal):null
      if(previousMember?.failed&&!previousMember.assistantMessageId)previousMember.deleted=false
      const createsPlayerVariant = operation.kind === 'player-edit' || operation.kind === 'player-edit-send' || operation.kind === 'edit'
      const original = group.members.find(member => isRecoverySourceMember(member, anchor, sourceEvent))
      const basePlayerVariantId = previousMember?.playerVariantId ?? original?.playerVariantId ?? Object.keys(group.playerVariants)[0] ?? `${groupId}:player:1`
      const playerVariantId = createsPlayerVariant ? `${groupId}:player:${randomUUID()}` : basePlayerVariantId
      const playerOrdinal = createsPlayerVariant
        ? Math.max(0, ...group.members.map(member => Number(member.playerOrdinal) || 0)) + 1
        : Number(previousMember?.playerOrdinal ?? original?.playerOrdinal) || 1
      if (createsPlayerVariant) {
        group.playerVariants[playerVariantId] = { text: operation.promptText, revision: 1, updatedAt: Date.now() }
      } else if (String(group.playerVariants[playerVariantId]?.text ?? '') !== String(operation.promptText ?? '')) {
        // Schema-v1 members can have neither promptText nor a stored player
        // variant.  The live, verified recovery source is then the only
        // evidence available to repair that empty slot.
        const legacyEmptyVariant = previousMember
          && !String(previousMember.promptText ?? '').trim()
          && !String(group.playerVariants[playerVariantId]?.text ?? '').trim()
        if (legacyEmptyVariant) {
          group.playerVariants[playerVariantId] = { text: operation.promptText, revision: 1, updatedAt: Date.now() }
        } else {
          throw new Error('原始玩家消息已在其他分支修改，请刷新后重新生成')
        }
      }
      group.members.push({
        operationId: operation.operationId,
        requestId: operation.requestId,
        sessionId: child.id,
        ordinal,
        kind: operation.kind,
        promptText: operation.promptText,
        userMessageId: null,
        userSeq: null,
        playerVariantId,
        playerOrdinal,
        playerTextRevision: 1,
        playerAppliedRevision: 0,
        assistantMessageId: null,
        assistantSeq: null,
        createdAt: Date.now(),
        deleted: false,
        pending: true,
      })
      group.updatedAt = Date.now()
      await T.branch.put(forkGroupKey(groupId), group)
      await T.branch.put(forkPendingKey(child.id, groupId), { groupId, ordinal, operationId: operation.operationId, requestId: operation.requestId, createdAt: Date.now() })
      return { groupId, ordinal, total: group.members.filter((m) => !m.deleted).length, playerOrdinal, playerTotal: new Set(group.members.filter((m) => !m.deleted).map(member => member.playerVariantId)).size }
    })
  }

  async function reconcileNativeFork(session, completedAssistant = null) {
    const prefix = `${session.id}__fork-pending-`
    const pendingEntries = [...T.branch.entries()].filter(([key, value]) => key.startsWith(prefix) && value)
    if (!pendingEntries.length) return
    for (const [pendingKey, pending] of pendingEntries) {
      const requestId = String(pending?.requestId ?? '')
      const userEvent = requestUserEvent(session, requestId)
      const turn = userEvent ? turnForEvent(session, userEvent) : null
      const candidate = completedAssistant && Number(completedAssistant.data?.turn) === Number(turn)
        ? completedAssistant
        : turn === null ? null : canonicalAssistantForTurn(session, turn)
      const messageId = assistantMessageId(candidate)
      const userBeforeAssistant = userEvent && candidate && Number(userEvent.seq) < Number(candidate.seq)
      if (requestId && userBeforeAssistant && messageId) {
        await withForkMutationLock(forkGroupLockKey(pending.groupId), async () => {
          const group = hydrateForkGroup(T.branch.get(forkGroupKey(pending.groupId)))
          const member = group?.members?.find((item) =>
            item.sessionId === session.id &&
            Number(item.ordinal) === Number(pending.ordinal) &&
            item.operationId === pending.operationId &&
            String(item.requestId ?? '') === requestId)
          if (!group || !member) return
          if (member.deleted) {
            await T.branch.delete(pendingKey)
            return
          }
          if (member.pending) {
            member.assistantMessageId = messageId
            member.assistantSeq = Number(candidate.seq)
            member.userMessageId = String(userEvent.data?.id ?? '')
            member.userSeq = Number(userEvent.seq)
            member.playerAppliedRevision = Number(member.playerTextRevision) || 1
            member.pending = false
            member.completedAt = Date.now()
            group.updatedAt = Date.now()
            await T.branch.put(forkGroupKey(group.groupId), group)
          }
          // Crash recovery: group.put may have succeeded while the pointer and
          // pending cleanup did not. Replaying those tail writes is idempotent.
          const settledMessageId = String(member.assistantMessageId ?? messageId)
          if (settledMessageId) {
            await T.branch.put(forkAnchorKey(session.id, settledMessageId), { groupId: group.groupId })
          }
          await T.branch.delete(pendingKey)
        })
        continue
      }

      // Pre-requestId pending records cannot be safely recovered after a
      // restart: a later ordinary turn must never be mistaken for this fork.
      if (!requestId) {
        await withForkMutationLock(forkGroupLockKey(pending.groupId), async () => {
          const group = hydrateForkGroup(T.branch.get(forkGroupKey(pending.groupId)))
          const member = group?.members?.find((item) =>
            item.sessionId === session.id && Number(item.ordinal) === Number(pending.ordinal))
          if (group && member?.pending) {
            member.pending = false
            member.deleted = true
            member.failed = true
            member.failureReason = '旧版待处理分支缺少 requestId，已拒绝猜测绑定'
            member.deletedAt = Date.now()
            group.updatedAt = Date.now()
            await T.branch.put(forkGroupKey(group.groupId), group)
          }
          await T.branch.delete(pendingKey)
        })
      }
    }
  }

  async function failPendingNativeFork(session, reason) {
    const prefix = `${session.id}__fork-pending-`
    const pendingEntries = [...T.branch.entries()].filter(([key, value]) => key.startsWith(prefix) && value)
    for (const [pendingKey, pending] of pendingEntries) {
      await withForkMutationLock(forkGroupLockKey(pending.groupId), async () => {
        const group = hydrateForkGroup(T.branch.get(forkGroupKey(pending.groupId)))
        const member = group?.members?.find((item) =>
          item.sessionId === session.id && Number(item.ordinal) === Number(pending.ordinal))
        if (group && member && member.pending) {
          member.pending = false
          member.failed = true
          // A provider failure is a recoverable worldline, not user deletion.
          member.deleted = false
          member.failureReason = String(reason ?? '生成未完成').slice(0, 500)
          member.failedAt = Date.now()
          group.updatedAt = Date.now()
          await T.branch.put(forkGroupKey(group.groupId), group)
        }
        await T.branch.delete(pendingKey)
      })
    }
  }

  async function repairLegacyRootForkPointer(session, lookup = null) {
    const visible = surfaceEvents(session)
    const visibleAssistants = visible.filter((event) => event?.type === 'assistant/message')
    const visibleIds = new Set(visibleAssistants.map(assistantMessageId).filter(Boolean))
    const candidates = Array.isArray(lookup?.groups)
      ? lookup.groups
      : [...T.branch.entries()]
          .filter(([key]) => String(key).startsWith('fork-group-'))
          .map(([, raw]) => hydrateForkGroup(raw))
          .filter(Boolean)
    for (const initial of candidates) {
      if (!initial || initial.rootSessionId !== session.id || !initial.anchor) continue
      const rootMember = initial.members.find((member) =>
        !member.deleted && !member.pending && ['original', 'root'].includes(member.kind) && member.sessionId === session.id)
      if (!rootMember?.assistantMessageId || visibleIds.has(rootMember.assistantMessageId)) continue
      const oldSeq = durableSeq(rootMember.assistantSeq)
      if (oldSeq === null) continue
      const placeholders = visible.map((event, position) => ({ event, position })).filter(({ event }) =>
        event?.type === 'user/message' && event.data?.source?.kind === 'plugin' &&
        event.data?.source?.plugin === 'roleplay' && event.data?.source?.form === 'superseded' &&
        event.surfaceOp?.op === 'replace' && replacementLineageContains(session, event, oldSeq))
      // Ambiguous legacy evidence is deliberately left untouched.  In a long
      // Session several historical groups can coexist; selecting the last
      // assistant merely by seq would point all of them at the newest turn.
      if (placeholders.length !== 1) continue
      const placeholderPosition = placeholders[0].position
      let boundary = visible.length
      for (let position = placeholderPosition + 1; position < visible.length; position += 1) {
        const event = visible[position]
        if (event?.type === 'user/message' && event.data?.source?.kind === 'user') {
          boundary = position
          break
        }
      }
      const markers = visible.slice(placeholderPosition + 1, boundary)
        .map((event, offset) => ({ event, position: placeholderPosition + 1 + offset }))
        .filter(({ event }) => event?.type === 'user/message' && event.data?.source?.kind === 'plugin' &&
          event.data?.source?.plugin === 'roleplay' && event.data?.source?.form === 'regenerate')
      if (markers.length !== 1) continue
      const candidates = visible.slice(markers[0].position + 1, boundary)
        .filter((event) => event?.type === 'assistant/message')
      if (candidates.length !== 1) continue
      const candidate = candidates[0]
      const candidateSeq = Number(candidate.seq)

      await withForkMutationLock(forkAnchorLockKey(initial.anchor), async () => {
        const group = hydrateForkGroup(T.branch.get(forkGroupKey(initial.groupId)))
        const member = group?.members?.find((item) =>
          !item.deleted && !item.pending && ['original', 'root'].includes(item.kind) && item.sessionId === session.id)
        if (!group || !member || visibleIds.has(member.assistantMessageId)) return
        member.legacyAssistantMessageId = member.assistantMessageId
        member.legacyAssistantSeq = member.assistantSeq
        member.assistantMessageId = assistantMessageId(candidate)
        member.assistantSeq = candidateSeq
        member.legacyPointerRepairedAt = Date.now()
        group.updatedAt = Date.now()
        await T.branch.put(forkGroupKey(group.groupId), group)
        await T.branch.put(forkAnchorKey(session.id, member.assistantMessageId), { groupId: group.groupId })
      })
    }
  }

  async function nativeBranchGroupsFor(session, lookup = null) {
    // Old in-place regeneration replaced the original assistant on the same
    // Session surface.  If that Session was later enrolled in the native fork
    // index, repair only its navigation pointer: the append-only audit log stays
    // untouched, while Chat/Reader can present the visible reply as one k/N slot.
    await repairLegacyRootForkPointer(session, lookup)
    await reconcileNativeFork(session)
    // repairLegacyRootForkPointer/reconcileNativeFork may create or retarget
    // the anchor pointer and settle a pending member.  Do not continue with
    // the pre-repair lookup index: a first state read after a regeneration
    // must expose the complete k/N group immediately, rather than only after
    // a later refresh happens to rebuild the index.
    lookup = buildForkLookupIndex()
    const result = {}
    for (const event of surfaceEvents(session)) {
      if (event?.type !== 'assistant/message') continue
      const messageId = assistantMessageId(event)
      if (!messageId) continue
      const pointer = forkPointerFor(session, messageId, lookup)
      const group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null
      if (!group) continue
      const current = groupMemberForSession(group, session, messageId)
      if (!current) continue
      // Assistant paging belongs to the currently selected player wording.
      // The durable group retains every player variant for navigation, while
      // this projection exposes only sibling replies to that exact variant.
      const members = group.members.filter((member) => !member.deleted &&
        member.playerVariantId === current.playerVariantId)
      result[messageId] = {
        groupId: group.groupId,
        currentOrdinal: members.findIndex((member) => member === current) + 1,
        total: members.length,
        members: members.map((member, index) => ({
          sessionId: member.sessionId,
          ordinal: index + 1,
          sourceOrdinal: member.ordinal,
          kind: member.kind,
          pending: member.pending === true,
        })),
      }
    }
    return result
  }

  function deletedBranchMessageIdsFor(session, lookup = null) {
    const deleted = []
    for (const event of surfaceEvents(session)) {
      if (event?.type !== 'assistant/message') continue
      const messageId = assistantMessageId(event)
      const pointer = forkPointerFor(session, messageId, lookup)
      const group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null
      const member = group?.members?.find((item) =>
        item.sessionId === session.id && item.assistantMessageId === messageId)
      const lineageMember = groupMemberForSession(group, session, messageId, { includeDeleted: true })
      if (member?.deleted || (!member && lineageMember?.deleted)) deleted.push(messageId)
    }
    return deleted
  }

  // Native branch deletion is a navigation tombstone, not a surface rewrite.
  // Worker fences must consult that durable state as well as plot seq/hash.
  function storyBranchIsActive(session) {
    return deletedBranchMessageIdsFor(session).length === 0
  }

  function assertStoryBranchActive(session) {
    if (storyBranchIsActive(session)) return
    const error = new Error('当前剧情分支已删除；请切换到仍然活动的分支')
    error.code = 'ROLEPLAY_SOURCE_CHANGED'
    throw error
  }

  function inheritedAssistantMessageIdsFor(session, lookup = null) {
    const inherited = []
    for (const event of surfaceEvents(session)) {
      if (event?.type !== 'assistant/message') continue
      const messageId = assistantMessageId(event)
      const pointer = forkPointerFor(session, messageId, lookup)
      const group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null
      if (!group) continue
      const exact = group.members.find((member) =>
        member.sessionId === session.id && member.assistantMessageId === messageId)
      const ancestor = groupMemberForSession(group, session, messageId)
      if (!exact && ancestor) inherited.push(messageId)
    }
    return inherited
  }

  async function nativePlayerGroupsFor(session, assistantGroups) {
    const result = {}
    const entries = surfaceEntries(session)
    const publish = (user, value) => {
      const event = eventsOf(session)[Number(user.seq)]
      const aliases = event ? replacementLineageSeqs(session, event) : [Number(user.seq)]
      if (!aliases.includes(Number(user.seq))) aliases.push(Number(user.seq))
      for (const seq of aliases) {
        if (Number.isSafeInteger(seq)) result[String(seq)] = value
      }
    }
    for (let index = 0; index < entries.length; index += 1) {
      const user = entries[index]
      if (user.kind !== 'user') continue
      let assistant = null
      for (let next = index + 1; next < entries.length; next += 1) {
        if (entries[next].kind === 'user') break
        if (entries[next].kind === 'assistant') assistant = entries[next]
      }
      const assistantGroup = assistant?.messageId ? assistantGroups[assistant.messageId] : null
      if (!assistantGroup) {
        publish(user, {
          userMessageId: user.messageId,
          assistantMessageId: assistant?.messageId ?? null,
          group: null,
        })
        continue
      }
      const stored = hydrateForkGroup(T.branch.get(forkGroupKey(assistantGroup.groupId)))
      const active = stored?.members?.filter((member) => !member.deleted) ?? []
      const current = groupMemberForSession(stored, session, assistant.messageId)
      if (!current) continue
      const variants = []
      for (const member of active) {
        let variant = variants.find((item) => item.playerVariantId === member.playerVariantId)
        if (!variant) {
          variant = {
            playerVariantId: member.playerVariantId,
            sourceOrdinal: Number(member.playerOrdinal) || variants.length + 1,
            candidates: [],
          }
          variants.push(variant)
        }
        variant.candidates.push(member)
      }
      variants.sort((a, b) => a.sourceOrdinal - b.sourceOrdinal)
      const currentIndex = variants.findIndex((variant) => variant.playerVariantId === current.playerVariantId)
      publish(user, {
        userMessageId: user.messageId,
        assistantMessageId: assistant.messageId,
        group: {
          groupId: stored.groupId,
          currentOrdinal: currentIndex + 1,
          total: variants.length,
          members: variants.map((variant, variantIndex) => {
            const representative = variant.candidates.find((member) => member.sessionId === session.id)
              ?? [...variant.candidates].reverse().find((member) => !member.pending)
              ?? variant.candidates.at(-1)
            return {
              sessionId: representative?.sessionId,
              ordinal: variantIndex + 1,
              sourceOrdinal: variant.sourceOrdinal,
              pending: representative?.pending === true,
            }
          }),
        },
      })
    }
    return result
  }

  function replaceTextBlocks(content, text) {
    const source = Array.isArray(content) ? content : []
    const output = []
    let inserted = false
    for (const block of source) {
      if (block?.type === 'text') {
        if (!inserted) output.push({ type: 'text', text })
        inserted = true
      } else {
        output.push(block)
      }
    }
    if (!inserted) output.unshift({ type: 'text', text })
    return output
  }

  function visibleSurfaceEvent(session, predicate) {
    return [...surfaceEvents(session)].reverse().find(predicate) ?? null
  }

  function replacementLineageContains(session, event, requestedSeq) {
    const target = durableSeq(requestedSeq)
    if (target === null || !event || typeof event !== 'object') return false
    const pending = Array.isArray(event.sourceEventSeqs) ? [...event.sourceEventSeqs] : []
    const seen = new Set()
    while (pending.length) {
      const seq = durableSeq(pending.pop())
      if (seq === null || seen.has(seq)) continue
      if (seq === target) return true
      seen.add(seq)
      const ancestor = eventsOf(session)[seq]
      if (ancestor?.surfaceOp?.op === 'replace' && Array.isArray(ancestor.sourceEventSeqs)) {
        pending.push(...ancestor.sourceEventSeqs)
      }
    }
    return false
  }

  function replacementLineageSeqs(session, event) {
    if (!event || typeof event !== 'object') return []
    const pending = [event.seq]
    const seen = new Set()
    while (pending.length) {
      const seq = durableSeq(pending.pop())
      if (seq === null || seen.has(seq)) continue
      seen.add(seq)
      const candidate = eventsOf(session)[seq]
      if (candidate?.surfaceOp?.op === 'replace' && Array.isArray(candidate.sourceEventSeqs)) {
        pending.push(...candidate.sourceEventSeqs)
      }
    }
    return [...seen].sort((left, right) => left - right)
  }

  function stableUserMessageId(session, event) {
    const candidates = replacementLineageSeqs(session, event)
      .map((seq) => eventsOf(session)[seq])
      .filter((candidate) => candidate?.type === 'user/message' && candidate.data?.source?.kind === 'user')
    const origin = candidates.find((candidate) => candidate.surfaceOp?.op !== 'replace') ?? candidates[0] ?? event
    return String(origin?.data?.id ?? event?.data?.id ?? '')
  }

  async function repairLegacyUserReplacementIdentities(session) {
    let repaired = 0
    for (const event of [...surfaceEvents(session)]) {
      if (event?.type !== 'user/message' || event.data?.source?.kind !== 'user' || event.surfaceOp?.op !== 'replace') continue
      const stableId = stableUserMessageId(session, event)
      if (!stableId) continue
      const tagged = Number(event.data?.source?.roleplayRevision) === 1
      if (tagged && String(event.data?.id ?? '') === stableId) continue
      session.append('user/message', {
        ...event.data,
        id: stableId,
        source: { ...event.data.source, roleplayRevision: 1 },
      }, {
        surfaceOp: { op: 'replace', start: Number(event.seq), end: Number(event.seq) },
        sourceEventSeqs: [Number(event.seq)],
      })
      repaired += 1
    }
    return repaired
  }

  async function replaceAssistantText(session, messageId, text, lockAttempt = 0) {
    const initialPointer = forkPointerFor(session, messageId)
    const initialGroup = initialPointer?.groupId
      ? hydrateForkGroup(T.branch.get(forkGroupKey(initialPointer.groupId)))
      : null
    const lockKey = initialGroup?.anchor
      ? forkAnchorLockKey(initialGroup.anchor)
      : forkAnchorLockKey({ sourceSessionId: session.id, sourceAssistantMessageId: messageId })
    let retryWithCanonicalLock = false
    const replacement = await withForkMutationLock(lockKey, async () => {
      const livePointer = forkPointerFor(session, messageId)
      const liveGroup = livePointer?.groupId
        ? hydrateForkGroup(T.branch.get(forkGroupKey(livePointer.groupId)))
        : null
      const canonicalLockKey = liveGroup?.anchor ? forkAnchorLockKey(liveGroup.anchor) : lockKey
      if (canonicalLockKey !== lockKey) {
        retryWithCanonicalLock = true
        return null
      }
      const exactLiveMember = liveGroup?.members?.find((member) =>
        member.sessionId === session.id && member.assistantMessageId === messageId)
      const nearestLiveMember = groupMemberForSession(liveGroup, session, messageId, { includeDeleted: true })
      if (exactLiveMember?.deleted || (!exactLiveMember && nearestLiveMember?.deleted)) {
        throw new Error('这个回复版本已经删除，不能再编辑')
      }
      if (liveGroup && !exactLiveMember && nearestLiveMember) {
        throw new Error('这是从祖先分支继承的历史回复；请先用分支箭头切换到该版本所属会话再直接编辑')
      }
      const event = visibleSurfaceEvent(session, (candidate) =>
        candidate?.type === 'assistant/message' && assistantMessageId(candidate) === messageId)
      if (!event) throw new Error('当前分支中找不到这条 Agent 回复')
      const originalSeq = Number(event.seq)
      if (textOf(event.data?.message?.content) === text) {
        if (event.surfaceOp?.op === 'replace') {
          const sourceSeq = (Array.isArray(event.sourceEventSeqs) ? event.sourceEventSeqs : [])
            .map(durableSeq)
            .find((value) => value !== null) ?? originalSeq
          let metadataRecovered = false
          if (liveGroup && exactLiveMember) {
            if (Number(exactLiveMember.assistantSeq) !== originalSeq) {
              exactLiveMember.assistantSeq = originalSeq
              exactLiveMember.editedAt = Date.now()
              liveGroup.updatedAt = Date.now()
              await T.branch.put(forkGroupKey(liveGroup.groupId), liveGroup)
              metadataRecovered = true
            }
          }
          const receiptKey = editInvalidationKey(session.id, 'assistant', originalSeq)
          const receipt = cloneBranchRecord(T.branch.get(receiptKey))
          const invalidationAlreadyCommitted = receipt?.state === 'committed' &&
            durableSeq(receipt.sourceSeq) === sourceSeq && receipt.textSha256 === sha256(text)
          if (metadataRecovered || !invalidationAlreadyCommitted) {
            await invalidateDerivedStoryState(session, {
              fromSeq: sourceSeq,
              reason: 'assistant-message-edit-recovered',
            })
            await T.branch.put(receiptKey, {
              state: 'committed', role: 'assistant', sourceSeq,
              replacementSeq: originalSeq, textSha256: sha256(text), committedAt: Date.now(),
            })
          }
        }
        return event
      }
      const replacement = session.append('assistant/message', {
        ...event.data,
        message: {
          ...event.data.message,
          content: replaceTextBlocks(event.data.message?.content, text),
        },
      }, {
        surfaceOp: { op: 'replace', start: originalSeq, end: originalSeq },
        sourceEventSeqs: [originalSeq],
      })
      const group = liveGroup
      if (group && exactLiveMember) {
          exactLiveMember.assistantSeq = Number(replacement.seq)
          exactLiveMember.editedAt = Date.now()
          group.updatedAt = Date.now()
          await T.branch.put(forkGroupKey(group.groupId), group)
      }
      await invalidateDerivedStoryState(session, {
        fromSeq: originalSeq,
        reason: 'assistant-message-edited',
      })
      await T.branch.put(editInvalidationKey(session.id, 'assistant', Number(replacement.seq)), {
        state: 'committed', role: 'assistant', sourceSeq: originalSeq,
        replacementSeq: Number(replacement.seq), textSha256: sha256(text), committedAt: Date.now(),
      })
      return replacement
    })
    if (retryWithCanonicalLock) {
      if (lockAttempt >= 4) throw new Error('回复分支在并发修改期间持续变化，请重试')
      return replaceAssistantText(session, messageId, text, lockAttempt + 1)
    }
    return replacement
  }

  async function invalidateDerivedStoryState(session, { fromSeq, reason }) {
    const branchId = session.id
    const seq = durableSeq(fromSeq)
    // Edits preserve the user's chosen visible text but invalidate asynchronous
    // products that were derived from the former prose. They will be rebuilt by
    // a later completed generation; stale decision cards cannot pop up meanwhile.
    await withDecisionMutationLock(branchId, async () => {
      const key = keyOf(branchId, 'current')
      const current = normalizeDecisionRecord(T.decision.get(key))
      if (!current) return
      const decisionSeq = durableSeq(current.atSeq ?? current.seq)
      if (seq !== null && decisionSeq !== null && decisionSeq < seq) return
      await T.decision.put(key, {
        ...current,
        superseded: true,
        supersededAt: Date.now(),
        supersededReason: String(reason ?? 'surface-edited').slice(0, 120),
      })
    })
    const sceneKey = keyOf(branchId, 'current')
    const scene = cloneRecord(T.scene.get(sceneKey))
    const sceneSeq = durableSeq(scene?.updatedAtSeq ?? scene?.atSeq)
    if (scene && (seq === null || sceneSeq === null || sceneSeq >= seq)) {
      await T.scene.delete(sceneKey)
    }
    const panelKey = keyOf(branchId, 'panel')
    const panel = cloneRecord(T.status.get(panelKey))
    const panelSeq = durableSeq(panel?.atSeq ?? panel?.updatedAtSeq)
    if (panel && (seq === null || panelSeq === null || panelSeq >= seq)) {
      await T.status.put(panelKey, { ...panel, stale: true, invalidatedFromSeq: seq, invalidatedAt: Date.now() })
    }
    const memoryKey = keyOf(branchId, 'head')
    if (!T.memory.get(memoryKey)) {
      await T.memory.put(memoryKey, { deltas: [], lockedFacts: [], pendingConfirmations: [], version: 1 })
    }
    await T.memory.update(memoryKey, (current) => {
        const keepBeforeEdit = (item) => {
          if (!item || typeof item !== 'object') return false
          const owners = [item.sessionId, item.branchId, item.ownerSessionId]
            .map((value) => String(value ?? '').trim())
            .filter(Boolean)
          if (owners.length && !owners.includes(branchId)) return true
          const itemSeq = provenanceSeq(item)
          if (seq === null) return owners.length === 0
          return itemSeq === null || itemSeq < seq
        }
        return {
          ...current,
          archives: (Array.isArray(current?.archives) ? current.archives : []).filter(keepBeforeEdit),
          archiveDigests: (Array.isArray(current?.archiveDigests) ? current.archiveDigests : []).filter(keepBeforeEdit),
          deltas: (Array.isArray(current?.deltas) ? current.deltas : []).filter(keepBeforeEdit),
          pendingConfirmations: (Array.isArray(current?.pendingConfirmations) ? current.pendingConfirmations : []).filter(keepBeforeEdit),
          version: (Number(current?.version) || 1) + 1,
          invalidatedAt: Date.now(),
          invalidatedFromSeq: seq,
          invalidatedReason: String(reason ?? 'surface-edited').slice(0, 120),
        }
    })
  }

  async function reconcileCanonicalPlayerVariants(session, lookup = null) {
    await repairLegacyRootForkPointer(session, lookup)
    let synced = 0
    const visibleAssistants = surfaceEvents(session).filter((event) => event?.type === 'assistant/message')
    for (const assistant of visibleAssistants) {
      const messageId = assistantMessageId(assistant)
      if (!messageId) continue
      const pointer = forkPointerFor(session, messageId, lookup)
      const initialGroup = pointer?.groupId
        ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId)))
        : null
      const initialExactMember = initialGroup?.members?.find((member) =>
        member.sessionId === session.id && member.assistantMessageId === messageId)
      if (initialExactMember?.deleted) continue
      const initialMember = initialExactMember ?? groupMemberForSession(initialGroup, session, messageId)
      if (!initialGroup || !initialMember || initialMember.pending) continue
      const initialVariant = initialGroup.playerVariants?.[initialMember.playerVariantId]
      if (!initialVariant || typeof initialVariant.text !== 'string') continue
      const projectionKey = playerProjectionKey(session.id, initialGroup.groupId, initialMember.playerVariantId)
      const initialProjection = cloneBranchRecord(T.branch.get(projectionKey))
      const identityCandidates = [
        initialProjection?.userMessageId,
        initialExactMember?.userMessageId,
        initialMember.userMessageId,
      ].map((value) => String(value ?? '')).filter(Boolean)
      const seqCandidates = [
        initialProjection?.userSeq,
        initialExactMember?.userSeq,
        initialMember.userSeq,
      ].map(durableSeq).filter((value) => value !== null)
      const initialUser = visibleSurfaceEvent(session, (event) =>
        event?.type === 'user/message' && event.data?.source?.kind === 'user' && (
          identityCandidates.includes(String(event.data?.id ?? '')) ||
          seqCandidates.includes(Number(event.seq)) ||
          seqCandidates.some((seq) => replacementLineageContains(session, event, seq))
        )) ?? currentSurfaceUserBefore(session, assistant)?.event
      if (!initialUser) continue
      const initialRevision = Math.max(1, Number(initialVariant.revision) || 1)
      const appliedRevision = initialExactMember
        ? Number(initialExactMember.playerAppliedRevision)
        : Number(initialProjection?.revision)
      const initialIdentityStable = stableUserMessageId(session, initialUser) === String(initialUser.data?.id ?? '')
      if (textOf(initialUser.data?.content).trim() === initialVariant.text.trim() &&
        appliedRevision >= initialRevision && initialIdentityStable) continue

      await withForkMutationLock(forkAnchorLockKey(initialGroup.anchor), async () => {
        const group = hydrateForkGroup(T.branch.get(forkGroupKey(initialGroup.groupId)))
        const exactMember = group?.members?.find((item) =>
          item.sessionId === session.id && item.assistantMessageId === messageId)
        if (exactMember?.deleted) return
        const member = exactMember ?? groupMemberForSession(group, session, messageId)
        if (!group || !member || member.pending) return
        const variant = group.playerVariants?.[member.playerVariantId]
        if (!variant || typeof variant.text !== 'string') return
        const revision = Math.max(1, Number(variant.revision) || 1)
        const liveProjectionKey = playerProjectionKey(session.id, group.groupId, member.playerVariantId)
        const projection = cloneBranchRecord(T.branch.get(liveProjectionKey))
        const liveIds = [projection?.userMessageId, exactMember?.userMessageId, member.userMessageId]
          .map((value) => String(value ?? '')).filter(Boolean)
        const liveSeqs = [projection?.userSeq, exactMember?.userSeq, member.userSeq]
          .map(durableSeq).filter((value) => value !== null)
        const userEvent = visibleSurfaceEvent(session, (event) =>
          event?.type === 'user/message' && event.data?.source?.kind === 'user' && (
            liveIds.includes(String(event.data?.id ?? '')) ||
            liveSeqs.includes(Number(event.seq)) ||
            liveSeqs.some((seq) => replacementLineageContains(session, event, seq))
          )) ?? currentSurfaceUserBefore(session, assistant)?.event
        if (!userEvent) return
        const oldSeq = Number(userEvent.seq)
        const canonicalUserMessageId = stableUserMessageId(session, userEvent)
        const textChanged = textOf(userEvent.data?.content).trim() !== variant.text.trim()
        const identityNeedsRepair = userEvent.surfaceOp?.op === 'replace' &&
          String(userEvent.data?.id ?? '') !== canonicalUserMessageId
        let replacement = userEvent
        if (textChanged || identityNeedsRepair) {
          replacement = session.append('user/message', {
            ...userEvent.data,
            // A replacement is the next revision of the same logical Chat
            // Context. Keep the append-origin id; the UI consumes it as an
            // update while the durable replacement seq remains authoritative.
            id: canonicalUserMessageId,
            source: { ...userEvent.data?.source, roleplayRevision: 1 },
            content: replaceTextBlocks(userEvent.data?.content, variant.text),
          }, {
            surfaceOp: { op: 'replace', start: oldSeq, end: oldSeq },
            sourceEventSeqs: [oldSeq],
          })
          if (textChanged) {
            await invalidateDerivedStoryState(session, {
              fromSeq: oldSeq,
              reason: 'player-message-canonical-sync',
            })
            await T.branch.put(editInvalidationKey(session.id, 'user', Number(replacement.seq)), {
              state: 'committed', role: 'user', sourceSeq: oldSeq,
              replacementSeq: Number(replacement.seq), textSha256: sha256(variant.text), committedAt: Date.now(),
            })
          }
          synced += 1
        }
        if (exactMember) {
          exactMember.userMessageId = String(replacement.data?.id ?? exactMember.userMessageId ?? '')
          exactMember.userSeq = Number(replacement.seq)
          exactMember.promptText = variant.text
          exactMember.playerTextRevision = revision
          exactMember.playerAppliedRevision = revision
          exactMember.playerEditSourceSeq = oldSeq
          exactMember.editedAt = Date.now()
          group.updatedAt = Date.now()
          await T.branch.put(forkGroupKey(group.groupId), group)
        } else {
          await T.branch.put(liveProjectionKey, {
            groupId: group.groupId,
            playerVariantId: member.playerVariantId,
            sourceMemberSessionId: member.sessionId,
            userMessageId: String(replacement.data?.id ?? ''),
            userSeq: Number(replacement.seq),
            revision,
            textSha256: sha256(variant.text),
            updatedAt: Date.now(),
          })
        }
      })
    }
    return { synced }
  }

  function userForkContext(session, seq) {
    const requested = Number(seq)
    const event = visibleSurfaceEvent(session, (candidate) =>
      candidate?.type === 'user/message' && Number(candidate.seq) === requested && candidate.data?.source?.kind === 'user')
      ?? visibleSurfaceEvent(session, (candidate) =>
        candidate?.type === 'user/message' && candidate.data?.source?.kind === 'user' &&
        replacementLineageContains(session, candidate, requested))
    if (!event) throw new Error('当前分支中找不到这条玩家消息')
    const surface = surfaceEvents(session)
    const userIndex = surface.findIndex((candidate) => Number(candidate?.seq) === Number(event.seq))
    let followingAssistant = null
    for (let index = userIndex + 1; index < surface.length; index += 1) {
      if (surface[index]?.type === 'user/message' && surface[index].data?.source?.kind === 'user') break
      if (surface[index]?.type === 'assistant/message') followingAssistant = surface[index]
    }
    const pointer = followingAssistant
      ? forkPointerFor(session, assistantMessageId(followingAssistant))
      : null
    const group = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null
    return { event, followingAssistant, group }
  }

  // A provider failure can leave a real player message with no assistant
  // message below it.  It is still a valid recovery anchor: fork before the
  // failed turn and replay the corrected prompt in a clean child session.
  function locatePlayerRecoveryTarget(session, seq) {
    const context = userForkContext(session, seq)
    const userEvent = context.event
    const userTurn = turnForEvent(session, userEvent)
    if (!Number.isSafeInteger(Number(userTurn))) {
      throw new Error('失败轮次缺少有效 turn，无法安全恢复')
    }
    const events = eventsOf(session)
    if (canonicalAssistantForTurn(session, Number(userTurn))) return null
    if (!events.some(event => event?.type === 'turn/end' && Number(event.data?.turn) === Number(userTurn))) throw new Error('本轮仍在运行，请等待结束后重新生成')
    const userIndex = Number(userEvent.seq)
    let previousTurnEndSeq = null
    for (let index = Math.min(userIndex, events.length - 1) - 1; index >= 0; index -= 1) {
      if (events[index]?.type !== 'turn/end') continue
      const turn = Number(events[index]?.data?.turn)
      if (!Number.isSafeInteger(turn) || turn >= Number(userTurn)) continue
      previousTurnEndSeq = Number(events[index].seq)
      break
    }
    const expectedSeedLength = previousTurnEndSeq === null ? 0 : (() => {
      let cut = previousTurnEndSeq + 1
      while (cut < events.length && events[cut]?.type !== 'turn/start') cut += 1
      return cut
    })()
    return {
      sourceSessionId: session.id,
      sourceUserMessageId: String(userEvent.data?.id ?? ''),
      sourceUserSeq: Number(userEvent.seq),
      sourceTurn: Number(userTurn),
      previousTurnEndSeq,
      expectedSeedLength,
      promptText: textOf(userEvent.data?.content).trim(),
      recoveryOnly: true,
    }
  }

  async function replaceUserText(session, seq, text, lockAttempt = 0) {
    const initial = userForkContext(session, seq)
    const lockKey = initial.group?.anchor
      ? forkAnchorLockKey(initial.group.anchor)
      : initial.followingAssistant
        ? forkAnchorLockKey({
            sourceSessionId: session.id,
            sourceAssistantMessageId: assistantMessageId(initial.followingAssistant),
          })
        : `surface:${session.id}`
    let retryWithCanonicalLock = false
    const result = await withForkMutationLock(lockKey, async () => {
      const live = userForkContext(session, seq)
      const group = live.group
      const canonicalLockKey = group?.anchor ? forkAnchorLockKey(group.anchor) : lockKey
      if (canonicalLockKey !== lockKey) {
        retryWithCanonicalLock = true
        return null
      }
      const currentMember = groupMemberForSession(group, session, assistantMessageId(live.followingAssistant))
      const targets = currentMember
        ? group.members.filter((member) => !member.deleted && member.playerVariantId === currentMember.playerVariantId)
        : [{ sessionId: session.id, userMessageId: String(live.event.data?.id ?? ''), userSeq: Number(live.event.seq) }]
      if (currentMember && !targets.some((member) => member.sessionId === session.id)) {
        targets.push({
          projectionOnly: true,
          sessionId: session.id,
          userMessageId: String(live.event.data?.id ?? ''),
          userSeq: Number(live.event.seq),
          promptText: textOf(live.event.data?.content).trim(),
          playerVariantId: currentMember.playerVariantId,
          playerOrdinal: currentMember.playerOrdinal,
        })
      }
      let canonicalRevision = null
      if (group && currentMember) {
        const currentVariant = group.playerVariants[currentMember.playerVariantId] ?? {
          text: String(currentMember.promptText ?? textOf(live.event?.data?.content) ?? ''),
          revision: Number(currentMember.playerTextRevision) || 1,
        }
        const textChanged = String(currentVariant.text ?? '') !== text
        canonicalRevision = textChanged
          ? Math.max(1, Number(currentVariant.revision) || 1) + 1
          : Math.max(1, Number(currentVariant.revision) || 1)
        group.playerVariants[currentMember.playerVariantId] = {
          ...currentVariant,
          text,
          revision: canonicalRevision,
          updatedAt: textChanged ? Date.now() : Number(currentVariant.updatedAt ?? Date.now()),
          updatedBySessionId: session.id,
        }
        // Canonical text lives in the small group ledger, so cold sibling
        // Sessions do not need to be loaded merely to keep their prompt in
        // sync. Their surfaces are replaced lazily on next activation.
        for (const member of targets) {
          member.promptText = text
          member.playerTextRevision = canonicalRevision
        }
      }

      let changed = 0
      let matched = 0
      const invalidations = []
      for (const member of targets) {
        const targetSession = ctx.sessions.get(member.sessionId)
        if (!targetSession || !isRoleplaySession(targetSession)) continue
        const targetEvent = visibleSurfaceEvent(targetSession, (candidate) =>
          candidate?.type === 'user/message' && candidate.data?.source?.kind === 'user' && (
            (member.userMessageId && String(candidate.data?.id ?? '') === String(member.userMessageId)) ||
            Number(candidate.seq) === durableSeq(member.userSeq) ||
            replacementLineageContains(targetSession, candidate, member.userSeq) ||
            (!member.userMessageId && textOf(candidate.data?.content).trim() === String(member.promptText ?? '').trim())
          ))
        if (!targetEvent) continue
        const originalSeq = Number(targetEvent.seq)
        const alreadyApplied = textOf(targetEvent.data?.content).trim() === text
        const canonicalUserMessageId = stableUserMessageId(targetSession, targetEvent)
        const identityNeedsRepair = targetEvent.surfaceOp?.op === 'replace' &&
          String(targetEvent.data?.id ?? '') !== canonicalUserMessageId
        const requestedOriginSeq = replacementLineageContains(targetSession, targetEvent, seq)
          ? durableSeq(seq)
          : null
        const invalidationSeq = alreadyApplied
          ? durableSeq(member.playerEditSourceSeq) ?? requestedOriginSeq ?? durableSeq(member.userSeq) ?? originalSeq
          : originalSeq
        const replacement = alreadyApplied && !identityNeedsRepair ? targetEvent : targetSession.append('user/message', {
          ...targetEvent.data,
          // Preserve the append-origin identity. Official ui-chat classifies
          // this replacement as a Context update, so the message keeps its
          // visual position while its current surface seq advances.
          id: canonicalUserMessageId,
          source: { ...targetEvent.data?.source, roleplayRevision: 1 },
          content: replaceTextBlocks(targetEvent.data?.content, text),
        }, {
          surfaceOp: { op: 'replace', start: originalSeq, end: originalSeq },
          sourceEventSeqs: [originalSeq],
        })
        const receiptKey = editInvalidationKey(targetSession.id, 'user', Number(replacement.seq))
        const receipt = cloneBranchRecord(T.branch.get(receiptKey))
        const invalidationAlreadyCommitted = receipt?.state === 'committed' &&
          durableSeq(receipt.sourceSeq) === invalidationSeq && receipt.textSha256 === sha256(text)
        if (!alreadyApplied || (targetEvent.surfaceOp?.op === 'replace' && !identityNeedsRepair && !invalidationAlreadyCommitted)) {
          invalidations.push({
            targetSession,
            originalSeq: invalidationSeq,
            replacementSeq: Number(replacement.seq),
            textSha256: sha256(text),
          })
        }
        member.userMessageId = String(replacement.data?.id ?? targetEvent.data?.id ?? '')
        member.userSeq = Number(replacement.seq)
        member.promptText = text
        if (canonicalRevision !== null) member.playerAppliedRevision = canonicalRevision
        member.playerEditSourceSeq = invalidationSeq
        member.editedAt = Date.now()
        if (member.projectionOnly && group && currentMember) {
          await T.branch.put(playerProjectionKey(targetSession.id, group.groupId, currentMember.playerVariantId), {
            groupId: group.groupId,
            playerVariantId: currentMember.playerVariantId,
            sourceMemberSessionId: currentMember.sessionId,
            userMessageId: member.userMessageId,
            userSeq: member.userSeq,
            revision: canonicalRevision,
            textSha256: sha256(text),
            updatedAt: Date.now(),
          })
        }
        matched += 1
        if (!alreadyApplied) changed += 1
      }
      if (group && currentMember) {
        group.updatedAt = Date.now()
        await T.branch.put(forkGroupKey(group.groupId), group)
      }
      if (matched === 0) throw new Error('玩家消息替换未能写入当前 surface')
      for (const item of invalidations) {
        await invalidateDerivedStoryState(item.targetSession, {
          fromSeq: item.originalSeq,
          reason: 'player-message-edited',
        })
        await T.branch.put(editInvalidationKey(item.targetSession.id, 'user', item.replacementSeq), {
          state: 'committed', role: 'user', sourceSeq: item.originalSeq,
          replacementSeq: item.replacementSeq, textSha256: item.textSha256, committedAt: Date.now(),
        })
      }
      return { changed, matched, replayed: changed === 0 }
    })
    if (retryWithCanonicalLock) {
      if (lockAttempt >= 4) throw new Error('玩家分支在并发修改期间持续变化，请重试')
      return replaceUserText(session, seq, text, lockAttempt + 1)
    }
    return result
  }

  // ── 工具：rp_* ─────────────────────────────────────────────────────────────

  const simpleTool = (name, description, parameters, execute) => ({
    name,
    description,
    parameters,
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [
        { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
      ],
    },
    execute,
    timeoutMs: 120000,
  })

  const sessionOf = async (exec) => {
    let session = exec?.agent?.session
    const roleJob=clusterJob(exec?.agent)
    if(roleJob){
      if(roleJob.status!=='running'||roleJob.childSessionId!==session.id)throw new Error('角色推演授权已失效')
      const owner=await resolveRoleplaySession(roleJob.sessionId)
      if(!owner||!storyBranchIsActive(owner)||!characterCluster.read(owner).enabled)throw new Error('角色所属世界线已失效')
      return owner
    }
    const descriptor=eventsOf(session).find(e=>e?.type==='subagent/descriptor'&&e.seq>=Number(session?.header?.seedLength??0))
    if(descriptor) {
      const match=String(descriptor.data?.label??'').match(/^Tavern:([a-f0-9]{64}):([a-f0-9-]{36})$/)
      const task=match?T.branch.get(`tavern_job__${match[1]}`):null
      if(!task||task.generation!==match[2]||task.source?.workflowType!=='card'||['cancelled','stale','failed','completed'].includes(task.status)||task.sessionId!==session.header?.parentSession)throw new Error('辅助任务授权已失效')
      const workflow=T.branch.get(cardWorkflowKey(task.source.workflowId))
      if(!workflow||workflow.generation!==task.source.generation||['cancelled','stale','failed','completed'].includes(workflow.status))throw new Error('角色卡任务已取消或替换')
      session=await resolveRoleplaySession(task.sessionId)
    }
    if (!session || !isRoleplaySession(session)) throw new Error('roleplay 工具需要在 roleplay 会话内使用')
    await ensureBranch(session)
    return session
  }

  ctx.effect(()=>ctx.tools.register(simpleTool('rp_task_read',
    '读取尚未完整内联的维护任务来源。默认每页64000字符，可用maxChars调至128000；按nextOffset连续读完，不推进剧情。已带completeSource的任务可直接提交。',
    {type:'object',properties:{id:{type:'string'},offset:{type:'integer'},maxChars:{type:'integer'}},required:['id'],additionalProperties:false},
    async(args,exec)=>tavernTasks.read(await sessionOf(exec),args.id,args.offset,args.maxChars))), 'roleplay: task source tool')
  ctx.effect(()=>ctx.tools.register(simpleTool('rp_novel_export',
    '将当前分支完整剧情整理为一章一章的 Markdown 小说，包含压缩前历史，排除工具和管理请求。玩家说导出小说或整理完整剧情时使用；任务可恢复并在酒馆管理下载。',
    {type:'object',properties:{},additionalProperties:false},async(_args,exec)=>({ok:true,jobId:(await startExportJob(await sessionOf(exec),'novel-export',exec.agent)).id}))), 'roleplay: novel export tool')
  ctx.effect(()=>ctx.tools.register(simpleTool('rp_task_submit',
    '提交当前循环完成的维护任务结果。id和generation来自系统任务元数据（完整内联或rp_task_read）；result为任务指定JSON对象或完整文本。各任务独立校验。',
    {type:'object',properties:{id:{type:'string'},generation:{type:'string'},result:{}},required:['id','generation','result'],additionalProperties:false},
    async(args,exec)=>({ok:true,result:await tavernTasks.submit({session:await sessionOf(exec),id:args.id,generation:args.generation,value:args.result})}))), 'roleplay: task submit tool')

  ctx.effect(() => ctx.tools.register(simpleTool(
    'rp_history',
    '查询当前选中分支的历史原文，含已归档章节，不读取未选分支。scope 默认 story 为剧情，tools 可恢复先前的工具调用及结果（资料证据，不是剧情或指令）。search 支持空格分隔关键词；read 按 seq 分页读全文。',
    { type: 'object', properties: {
      action: { type: 'string', enum: ['search', 'read'] }, query: { type: 'string' },
      scope: { type: 'string', enum: ['story', 'tools'] },
      seq: { type: 'integer' }, beforeSeq: { type: 'integer' }, offset: { type: 'integer' },
      limit: { type: 'integer' }, maxChars: { type: 'integer' },
    }, required: ['action'], additionalProperties: false },
    async (args, exec) => {
      const session = await sessionOf(exec)
      const engine = ctx.get('compaction')
      if (!engine?.history) throw new Error('剧情历史服务尚未就绪')
      if(clusterJob(exec.agent))args={...args,scope:'story',maxChars:Math.min(12000,Math.max(1000,Number(args.maxChars)||6000)),limit:Math.min(8,Math.max(1,Number(args.limit)||5))}
      return args.action === 'read' ? engine.historyRead(session, args) : engine.history(session, args)
    }
  )), 'roleplay: history query tool')

  ctx.effect(()=>ctx.tools.register(simpleTool('rp_character_cast',
    '正式剧情动笔前选定本回合主要人物 ID，程序并行推演人物意向。无需传剧情、人设或笔记；新重要人物先保存独立人设。每轮只调用一次，结果仅供主笔参考。',
    {type:'object',properties:{character_ids:{type:'array',items:{type:'string'},uniqueItems:true,maxItems:24}},required:['character_ids'],additionalProperties:false},
    async(args,exec)=>{
      const session=await sessionOf(exec),agent=exec.agent
      if(Number(agent.options?.subagentDepth)>0)throw new Error('角色不能递归创建集群')
      const turn=Number(eventsOf(session).findLast(e=>e.type==='turn/start')?.data?.turn)
      const snapshot=T.branch.get(keyOf(session.id,`task-snapshot-${turn}`))
      if(!snapshot||activeCardWorkflow(session))throw new Error('集群只用于正式剧情回合')
      const imported=eventsOf(session).some(e=>e.type==='tool/call'&&e.data?.turn===turn&&['rp_card_import_begin','rp_card_import_finalize','rp_commit_card','rp_card_draft_check','rp_diagnose'].includes(e.data?.name))
      if(imported)throw new Error('读卡、创作或管理回合不执行角色推演')
      const roster=characterRoster(session),ids=[...new Set(args.character_ids??[])]
      if(ids.length>24||ids.some(id=>!roster.some(c=>c.id===id)))throw new Error('选角含未知人物，请刷新人物列表或先登记新重要人物')
      const planKey=keyOf(session.id,`cluster-plan-${turn}`)
      return withTavernLock(T.branch,planKey,async()=>{
        const deliver=result=>{
          const context=taskPhaseMessage('story','角色推演已返回，现在进入正式正文。把人物意向作为参考，协调冲突后创作；不要复述后台准备过程。',{turn,characterCast:true})
          if(exec.deferContext)exec.deferContext(context);else agent.steer(context)
          return result
        }
        const previous=T.branch.get(planKey)
        if(previous?.result)return deliver(previous.result)
        const all=surfaceEntries(session),window=T.branch.get(contextWindowKey(session.id))
        const stories=all.filter(e=>e.seq>Number(window?.startSeq??-1))
        const recentTurns=new Set([turn,...all.filter(e=>e.kind==='assistant').slice(-3).map(e=>e.turn)])
        const lore=[...T.branch.entries()].filter(([key,v])=>key.startsWith(`${session.id}__cluster-lore-`)&&recentTurns.has(v.turn)&&clusterLoreVisible(session,v)).map(([,v])=>v)
        const notes=ctx.get('compaction')?.directorNotes?.(session)?.text??''
        const result=await characterCluster.run({session,agent,turn,characters:ids.map(id=>roster.find(c=>c.id===id)),signal:exec.signal,
          context:{stories,notes,lore,core:T.rules.get(keyOf(session.id,'spec'))?.core??'',userText:snapshot.userText}})
        await T.branch.put(planKey,{schemaVersion:1,branchId:session.id,turn,characterIds:ids,result,updatedAt:Date.now()})
        return deliver(result)
      })
    }
  )),'roleplay: character cast tool')

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_card_set',
        '写入或更新当前分支的一张角色卡（玩家角色用 card_id="user"）。角色卡始终作为独立设定注入；locked 仅表示关键设定，不会复制进剧情摘要。',
        {
          type: 'object',
          properties: {
            card_id: { type: 'string', description: '卡片 id；玩家角色固定用 "user"' },
            name: { type: 'string' },
            kind: { type: 'string', enum: ['user', 'npc', 'other'] },
            content: { type: 'string', description: '人设正文（性格/口吻/动机/秘密/外貌/能力/价值底线等）' },
            locked: { type: 'boolean' },
          },
          required: ['card_id', 'content'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          const cardId = String(args.card_id)
          if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cardId)) return { ok: false, error: `card_id 只能包含字母/数字/下划线/连字符（1-64 字符）：${cardId}` }
          const prev = T.cards.get(keyOf(session.id, cardId)) ?? {}
          const card = {
            ...prev, schemaVersion:1, verified:false,
            editedFrom:{sha256:recordSha256(prev),source:'native-tool',seq:lastSeq(session)},
            id: cardId,
            name: args.name ?? prev.name ?? cardId,
            kind: args.kind ?? prev.kind ?? (cardId === 'user' ? 'user' : 'npc'),
            content: String(args.content),
            locked: args.locked === true,
            version: (Number(prev.version) || 0) + 1,
            updatedAtSeq: lastSeq(session),
          }
          await T.cards.put(keyOf(session.id, card.id), card)
          return { ok: true, card_id: card.id, version: card.version }
        }
      )
    ),
    'roleplay: tool rp_card_set'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_card_list',
        '列出当前分支的全部角色卡（仅摘要，不含正文）。',
        { type: 'object', properties: {}, additionalProperties: false },
        async (_args, exec) => {
          const session = await sessionOf(exec)
          const prefix = `${session.id}__`
          const out = []
          for (const [k, v] of T.cards.entries()) {
            if (!k.startsWith(prefix) || !v) continue
            out.push({ id: v.id, name: v.name, kind: v.kind, locked: v.locked === true, version: v.version, chars: String(v.content ?? '').length })
          }
          return { cards: out }
        }
      )
    ),
    'roleplay: tool rp_card_list'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_worldbook_add',
        '向当前分支添加世界书条目（角色/地点/组织/国家/术语/物品/规则/时间线/剧情事件/风格）。写入前应先用 rp_worldbook_list 查重；内容有疑问时先问用户，不要编造。',
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ['character', 'place', 'org', 'country', 'term', 'item', 'rule', 'timeline', 'event', 'style'] },
            name: { type: 'string' },
            aliases: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            triggers: { type: 'array', items: { type: 'string' } },
            priority: { type: 'number' },
            token_budget: { type: 'number' },
            always_on: { type: 'boolean' },
            content: { type: 'string' },
            locked: { type: 'boolean' },
          },
          required: ['id', 'name', 'kind', 'content'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          const id = String(args.id)
          if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return { ok: false, error: `条目 id 只能包含字母/数字/下划线/连字符（1-64 字符）：${id}` }
          const prev = T.worldbook.get(keyOf(session.id, id))
          if (prev) return { ok: false, error: `条目 ${id} 已存在；用 rp_worldbook_update 修改，或先 rp_worldbook_remove` }
          const entry = {
            id,
            kind: args.kind ?? 'term',
            name: String(args.name),
            aliases: args.aliases ?? [],
            keywords: args.keywords ?? [],
            triggers: args.triggers ?? [],
            priority: Number(args.priority) || 0,
            tokenBudget: Number(args.token_budget) || 400,
            alwaysOn: args.always_on === true,
            content: String(args.content),
            locked: args.locked === true,
            version: 1,
            updatedAtSeq: lastSeq(session),
          }
          await T.worldbook.put(keyOf(session.id, id), entry)
          return { ok: true, id, version: 1 }
        }
      )
    ),
    'roleplay: tool rp_worldbook_add'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_worldbook_update',
        '更新当前分支的世界书条目（只改传入的字段；lock 或解锁用 locked 字段）。',
        {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            aliases: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            triggers: { type: 'array', items: { type: 'string' } },
            priority: { type: 'number' },
            token_budget: { type: 'number' },
            always_on: { type: 'boolean' },
            content: { type: 'string' },
            locked: { type: 'boolean' },
          },
          required: ['id'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          const id = String(args.id)
          if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return { ok: false, error: `条目 id 只能包含字母/数字/下划线/连字符（1-64 字符）：${id}` }
          const prev = T.worldbook.get(keyOf(session.id, id))
          if (!prev) return { ok: false, error: `条目 ${id} 不存在` }
          const next = { ...prev }
          for (const f of ['name', 'content']) if (args[f] !== undefined) next[f] = String(args[f])
          for (const f of ['aliases', 'keywords', 'triggers']) if (Array.isArray(args[f])) next[f] = args[f].map(String)
          if (args.priority !== undefined) next.priority = Number(args.priority) || 0
          if (args.token_budget !== undefined) next.tokenBudget = Number(args.token_budget) || 400
          if (args.always_on !== undefined) next.alwaysOn = args.always_on === true
          if (args.locked !== undefined) next.locked = args.locked === true
          next.version = (Number(prev.version) || 1) + 1
          next.updatedAtSeq = lastSeq(session)
          await T.worldbook.put(keyOf(session.id, id), next)
          return { ok: true, id, version: next.version }
        }
      )
    ),
    'roleplay: tool rp_worldbook_update'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_worldbook_remove',
        '从当前分支删除世界书条目。',
        { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
        async (args, exec) => {
          const session = await sessionOf(exec)
          await T.worldbook.delete(keyOf(session.id, String(args.id)))
          return { ok: true }
        }
      )
    ),
    'roleplay: tool rp_worldbook_remove'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_worldbook_list',
        '列出当前分支的世界书条目摘要（供查重与触发条件管理）。',
        { type: 'object', properties: {}, additionalProperties: false },
        async (_args, exec) => {
          const session = await sessionOf(exec)
          const prefix = `${session.id}__`
          const out = []
          for (const [k, v] of T.worldbook.entries()) {
            if (!k.startsWith(prefix) || !v) continue
            out.push({
              id: v.id,
              name: v.name,
              kind: v.kind,
              aliases: v.aliases,
              keywords: v.keywords,
              priority: v.priority,
              alwaysOn: v.alwaysOn === true,
              locked: v.locked === true,
              version: v.version,
            })
          }
          return { entries: out, count: out.length }
        }
      )
    ),
    'roleplay: tool rp_worldbook_list'
  )

  ctx.effect(()=>ctx.tools.register(simpleTool(
    'rp_worldbook_search',
    '按导演笔记、当前问题中的明确关键词查询当前分支世界书。世界书是被动资料库；查询结果不是已发生事件。可先用 rp_worldbook_list 查看名称与关键词。',
    {type:'object',properties:{query:{type:'string',minLength:1,maxLength:2400},max_tokens:{type:'integer',minimum:500,maximum:16000}},required:['query'],additionalProperties:false},
    async(args,exec)=>{
      const session=await sessionOf(exec),query=String(args.query??'').trim()
      if(!query||query.length>2400)return {ok:false,error:'请输入 1–2400 字的世界书查询关键词'}
      const sourceHash=recordSha256([...T.worldbook.entries()].filter(([key])=>key.startsWith(`${session.id}__`)))
      const found=await retrieveWorldbook(T,session.id,query,null,Math.min(16000,Math.max(500,Number(args.max_tokens)||6000)))
      if(!storyBranchIsActive(session)||sourceHash!==recordSha256([...T.worldbook.entries()].filter(([key])=>key.startsWith(`${session.id}__`))))return {ok:false,error:'查询来源已变更，请重试'}
      if(found.text)await T.branch.put(keyOf(session.id,`cluster-lore-${lastSeq(session)}`),{schemaVersion:1,branchId:session.id,seq:lastSeq(session),
        turn:Number(eventsOf(session).findLast(e=>e.type==='turn/start')?.data?.turn),callId:exec.rootCallId??exec.callId,text:found.text,sourceHash})
      return {ok:true,branchId:session.id,sourceHash,count:found.entries.length,entries:found.entries.map(e=>({id:e.id,name:e.name,version:e.version})),text:found.text?fenceCardContent(found.text,'worldbook'):''}
    }
  )),'roleplay: tool rp_worldbook_search')

  // ── 可审计的来源跨度式读卡导入 ────────────────────────────────────────────
  // 模型只负责判断“哪几行属于哪个栏目”；真正写入的正文由后端从已归档的
  // normalizedSource 截取。这样模型无法在工具参数里把 20K 原卡改写成 3K 摘要。

  const importRecordKey = (sessionId, importId) => keyOf(sessionId, `import-${safeId(importId)}`)
  const importActiveKey = (sessionId) => keyOf(sessionId, 'import-active')
  registerCardExport(ctx, {simpleTool, sessionOf, table:T.branch, lock:(...args)=>withImportLock(...args),classificationGuide:CARD_CLASSIFICATION_GUIDE,
    workflowOf:session=>{const job=activeCardWorkflow(session);return job?.kind==='card-export'?job.id:undefined},
    workflowGeneration:session=>activeCardWorkflow(session)?.generation,
    assertWorkflow:assertCardWorkflow,
    beforeBegin:async(session,exec)=>{
      if(Number(exec.agent?.options?.subagentDepth)>0||eventsOf(exec.agent?.session).some(e=>e.type==='subagent/descriptor'))return null
      const job=await beginCardWorkflow(session,'card-export',null,exec.agent)
      if(job.execution==='spawn') {
        try{await resumeCardWorkflows(session,exec.agent,exec.signal)}catch(error){if(!isInlinePending(error))throw error}
        return {ok:true,job:T.branch.get(cardWorkflowKey(job.id)),pending:true}
      }
      return null
    },
    onCompleted:async(session,record,markdown)=>{
      assertCardWorkflow(session,record)
      const resource=await libraryFor(session).archive({name:resourceName(record.title??'角色卡'),type:'text/markdown',bytes:Buffer.from(markdown,'utf8'),source:{sessionId:session.id,kind:'card-export',exportId:record.exportId}})
      assertCardWorkflow(session,record)
      await completeCardWorkflow(session,record,{exportId:record.exportId,file:record.file,resourceId:resource.id})
      return resource
    },
    collect:async session=>{
      await ensureBranch(session)
      const prefix=`${session.id}__`, material=[]
      for(const [tableName,table,field] of [['cards',T.cards,'content'],['worldbook',T.worldbook,'content']]) {
        for(const [key,record] of [...table.entries()].sort(([a],[b])=>a.localeCompare(b,'en'))) {
          if(!key.startsWith(prefix)||!record)continue
          const {content,...metadata}=record
          const source={table:tableName,key,sha256:sha256(stableJson(record))}
          material.push({label:`${tableName}: ${record.name??record.id}`,text:String(record[field]??''),source})
          material.push({label:`${tableName} 条目属性与来源: ${record.id}`,text:'```json\n'+stableJson(metadata)+'\n```',source})
        }
      }
      for(const [tableName,table,id] of [['rules',T.rules,'spec'],['status',T.status,'spec'],['opening',T.opening,'scene']]) {
        const record=table.get(keyOf(session.id,id))
        if(!record)continue
        const source={table:tableName,key:keyOf(session.id,id),sha256:sha256(stableJson(record))}, metadata={...record}
        for(const field of (tableName==='rules'?RULE_TEXT_FIELDS:['text'])){
          if(record[field])material.push({label:`${tableName}: ${field}`,text:String(record[field]),source})
          delete metadata[field]
        }
        if(metadata.beauty){
          for(const field of ['css','js']) if(metadata.beauty[field])material.push({label:`正文美化 ${field}`,text:'```'+field+'\n'+metadata.beauty[field]+'\n```',source})
          const {css,js,...beauty}=metadata.beauty; metadata.beauty=beauty
        }
        material.push({label:`${tableName} 属性与来源`,text:'```json\n'+stableJson(metadata)+'\n```',source})
      }
      const pointer=T.branch.get(importActiveKey(session.id))
      const original=pointer?.importId?T.branch.get(importRecordKey(pointer.sourceRecordSessionId??session.id,pointer.importId)):null
      const structuredOriginals=new Map(original?.sourceEnvelope?[[original.importId,original]]:[])
      // Export referenced appendices from every merged import, including an
      // inherited source record. Do not silently drop unclassified MD text.
      for(const ref of T.rules.get(keyOf(session.id,'spec'))?.sources?.archiveOnly??[]){
        const candidates=[...T.branch.entries()].filter(([,r])=>r?.importId===ref.importId&&r?.normalizedSha256===ref.normalizedSourceSha256&&typeof r.normalizedSource==='string')
        const record=candidates[0]?.[1]
        if(!record)throw new Error('附加资料来源缺失；请恢复原始导入记录后重试导出')
        assertImportRecordIntegrity(record)
        const text=spanText(record,normalizeSourceSpans(ref.sourceSpans,record.lineCount))
        if(sha256(text)!==ref.sourceSha256)throw new Error('附加资料来源哈希变化，不能完整导出')
        // Structured originals are represented by current fields plus extras,
        // so the old raw document cannot masquerade as current edited content.
        if(record.sourceEnvelope){structuredOriginals.set(record.importId,record);if(text.startsWith('## 完整结构化原件（只归档，不注入剧情）'))continue}
        if(text.trim())material.push({label:`附加资料（原文保留）: ${ref.name??ref.importId}`,text,source:ref})
      }
      for(const original of structuredOriginals.values()){
        const decoded=decodeTavernCard(Buffer.from(original.sourceEnvelope.base64,'base64'),original.sourceEnvelope.extension)
        const extras={...decoded.data}
        for(const field of ['name','description','personality','scenario','first_mes','mes_example','system_prompt','post_history_instructions','character_book'])delete extras[field]
        if(decoded.data.character_book){const {entries,...bookSettings}=decoded.data.character_book;extras.character_book_settings=bookSettings;extras.character_book_entry_metadata=Object.values(entries??{}).map(({content,...metadata})=>metadata)}
        if(decoded.document!==decoded.data){const {data,...wrapper}=decoded.document;extras.wrapper_fields=wrapper}
        material.push({label:'原件附加字段（未映射资料；不覆盖当前编辑）',text:'```json\n'+stableJson(extras)+'\n```',source:{importId:original.importId,rawSha256:original.rawSha256}})
      }
      return material
    }})
  const IMPORT_NORMALIZER = 'utf8-lf+anydoc-deescape-v2'
  const IMPORT_SOURCE_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.png', '.json'])
  // Hard limits protect the storage domain and the synchronous line/span
  // coverage pass from a malformed or adversarial tool payload.  These are
  // deliberately generous for long-form RP cards and reject rather than
  // silently truncate author material.
  const IMPORT_LIMITS = Object.freeze({
    maxBytes: 20_000_000,
    maxChars: 5_000_000,
    maxLines: 1_000_000,
    maxAssignments: 4096,
    maxSpansPerAssignment: 256,
    maxTotalSpans: 16_384,
    maxNameChars: 512,
    maxMetadataChars: 16_384,
    maxListItems: 256,
    maxListItemChars: 512,
    maxTotalMetadataChars: 2_000_000,
    maxTotalListItems: 16_384,
    maxReferencedChars: 40_000_000,
  })
  const importTableByName = {
    cards: T.cards,
    worldbook: T.worldbook,
    rules: T.rules,
    status: T.status,
    opening: T.opening,
  }

  const withImportLock = async (sessionId, _importId, task) => {
    const state = ensureState(sessionId)
    // All imports of one Session mutate the same material tables and active
    // pointer.  Locking by importId permits two different finalizes to
    // interleave and lets either rollback erase the other's writes.
    const lockKey = '__session__'
    const previous = state.importPending.get(lockKey) ?? Promise.resolve()
    const current = previous.catch(() => undefined).then(task)
    state.importPending.set(lockKey, current)
    try {
      return await current
    } finally {
      if (state.importPending.get(lockKey) === current) state.importPending.delete(lockKey)
    }
  }

  // Non-prompt read APIs cannot hold the material lock while composing their
  // response, but they must at least wait for an in-flight activation to leave
  // the committing state. Phase A itself acquires withImportLock and therefore
  // must not call this helper from inside that critical section.
  const awaitImportBarrier = async (sessionId) => {
    const pending = ensureState(sessionId).importPending.get('__session__')
    if (pending) await pending
  }

  const resolveImportSource = (session, requestedPath) => {
    const cwd = String(session?.header?.cwd ?? '').trim()
    if (!cwd) throw new Error('当前会话缺少 cwd，无法验证角色卡来源路径')
    const source = readCardSource(cwd, requestedPath)
    if (!IMPORT_SOURCE_EXTENSIONS.has(source.extension)) throw new Error('source_file 必须是 .md/.markdown/.txt 或酒馆 .png/.json 文件')
    return source
  }

  const computeLineStarts = (normalizedSource) => {
    const starts = [0]
    for (let index = 0; index < normalizedSource.length; index++) {
      if (normalizedSource.charCodeAt(index) === 10 && index + 1 < normalizedSource.length) starts.push(index + 1)
    }
    return starts
  }

  const lineStartsOf = (record) => {
    if (Array.isArray(record.lineStarts) && record.lineStarts.length === record.lineCount) return record.lineStarts
    return computeLineStarts(String(record.normalizedSource ?? ''))
  }

  const assertImportRecordIntegrity = (record) => {
    if (!record || typeof record !== 'object') throw new Error('导入记录损坏或不存在')
    const structured = record.schemaVersion === 4 && record.normalizer === 'tavern-fields-v1'
    if (!structured && (record.schemaVersion !== 3 || record.normalizer !== IMPORT_NORMALIZER)) {
      throw new Error('导入记录版本或规范化器不匹配；请从不可变 raw source 重新 begin')
    }
    const normalizedSource = record.normalizedSource
    if (typeof normalizedSource !== 'string' || !normalizedSource.length) throw new Error('导入记录缺少规范化原文')
    if (normalizedSource.length > IMPORT_LIMITS.maxChars) throw new Error('导入原文超过字符上限')
    const expectedLineCount = normalizedSource.split('\n').length - (normalizedSource.endsWith('\n') ? 1 : 0)
    if (!Number.isSafeInteger(record.lineCount) || record.lineCount !== expectedLineCount || record.lineCount < 1 || record.lineCount > IMPORT_LIMITS.maxLines) {
      throw new Error('导入记录行数元数据不一致')
    }
    if (sha256(normalizedSource) !== String(record.normalizedSha256 ?? '')) throw new Error('归档原文 SHA-256 校验失败')
    if (!structured && record.rawSource !== undefined && typeof record.rawSource === 'string' && record.rawSha256 !== undefined
      && sha256(record.rawSource) !== String(record.rawSha256)) throw new Error('原始来源 SHA-256 校验失败')
    if (typeof record.rawSource !== 'string'
      || Number(record.rawChars) !== record.rawSource.length
      || (!structured && Number(record.sourceBytes) !== Buffer.byteLength(record.rawSource, 'utf8'))
      || Number(record.normalizedChars) !== normalizedSource.length) {
      throw new Error('导入记录字符数或字节数元数据不一致')
    }
    if (structured) {
      const envelope = record.sourceEnvelope
      if (envelope?.schemaVersion !== 1 || typeof envelope.base64 !== 'string' || envelope.base64.length > 27_000_000) throw new Error('结构化原件归档无效')
      const bytes = Buffer.from(envelope.base64, 'base64')
      if (bytes.toString('base64') !== envelope.base64 || bytes.length !== record.sourceBytes || sha256(bytes) !== record.rawSha256) throw new Error('结构化原件哈希或大小校验失败')
      const decoded = decodeTavernCard(bytes, envelope.extension)
      if(decoded.format!==envelope.format||decoded.sourceSha256!==envelope.sourceSha256||record.rawSha256!==envelope.sourceSha256)throw new Error('结构化原件格式或来源证据不一致')
      if (JSON.stringify(decoded.document, null, 2) !== record.rawSource || projectTavernCard(decoded).text !== normalizedSource) throw new Error('结构化原件与投影不一致')
    }
    const expectedStarts = computeLineStarts(normalizedSource)
    if (!Array.isArray(record.lineStarts) || record.lineStarts.length !== expectedStarts.length
      || record.lineStarts.some((value, index) => Number(value) !== expectedStarts[index])) {
      throw new Error('导入记录行起始偏移元数据不一致')
    }
    if (!Array.isArray(record.lines) || record.lines.length !== expectedLineCount) throw new Error('导入记录行内容元数据不一致')
    const expectedLines = normalizedSource.split('\n').slice(0, expectedLineCount)
    if (record.lines.some((line, index) => line !== expectedLines[index])) throw new Error('导入记录行内容与规范化原文不一致')
    return true
  }

  const assertAssignmentBudget = (assignments) => {
    if (!Array.isArray(assignments) || assignments.length > IMPORT_LIMITS.maxAssignments) {
      throw new Error(`assignment 数量超过上限 ${IMPORT_LIMITS.maxAssignments}`)
    }
    let totalSpans = 0
    let totalMetadataChars = 0
    let totalListItems = 0
    for (const [index, assignment] of assignments.entries()) {
      if (!assignment || typeof assignment !== 'object') throw new Error(`assignment ${index + 1} 不是对象`)
      const spans = assignment.sourceSpans
      if (!Array.isArray(spans) || spans.length === 0 || spans.length > IMPORT_LIMITS.maxSpansPerAssignment) {
        throw new Error(`assignment ${index + 1} 的 sourceSpans 数量无效（上限 ${IMPORT_LIMITS.maxSpansPerAssignment}）`)
      }
      totalSpans += spans.length
      if (totalSpans > IMPORT_LIMITS.maxTotalSpans) throw new Error(`sourceSpans 总数超过上限 ${IMPORT_LIMITS.maxTotalSpans}`)
      for (const field of ['id', 'name', 'kind', 'merge_group', 'reuse_reason']) {
        const limit = field === 'name' || field === 'id' || field === 'kind'
          ? IMPORT_LIMITS.maxNameChars
          : IMPORT_LIMITS.maxMetadataChars
        if (assignment[field] !== undefined && String(assignment[field]).length > limit) {
          throw new Error(`assignment ${index + 1} 的 ${field} 过长`)
        }
        totalMetadataChars += assignment[field] === undefined ? 0 : String(assignment[field]).length
      }
      for (const field of ['aliases', 'keywords', 'triggers']) {
        if (assignment[field] !== undefined) {
          if (!Array.isArray(assignment[field]) || assignment[field].length > IMPORT_LIMITS.maxListItems) {
            throw new Error(`assignment ${index + 1} 的 ${field} 数量超过上限`)
          }
          if (assignment[field].some((value) => String(value).length > IMPORT_LIMITS.maxListItemChars)) {
            throw new Error(`assignment ${index + 1} 的 ${field} 项过长`)
          }
          totalListItems += assignment[field].length
          totalMetadataChars += assignment[field].reduce((sum, value) => sum + String(value).length, 0)
        }
      }
      if (totalListItems > IMPORT_LIMITS.maxTotalListItems) {
        throw new Error(`assignment 列表项总数超过上限 ${IMPORT_LIMITS.maxTotalListItems}`)
      }
      if (totalMetadataChars > IMPORT_LIMITS.maxTotalMetadataChars) {
        throw new Error(`assignment 元数据总字符数超过上限 ${IMPORT_LIMITS.maxTotalMetadataChars}`)
      }
    }
    return true
  }

  const assertReviewProof = (record) => {
    if (record.reviewComplete !== true || record.nextReadCursor !== null) {
      throw new Error(`全文尚未连续审阅完成；下一块 cursor=${record.nextReadCursor}`)
    }
    const ranges = Array.isArray(record.readRanges) ? record.readRanges : []
    if (!ranges.length) throw new Error('全文审阅证明缺失')
    if (ranges.length > Math.ceil(record.lineCount / 20)) throw new Error('全文审阅证明范围数量异常')
    let next = 1
    for (const range of ranges) {
      const start = Number(range?.startLine)
      const end = Number(range?.endLine)
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || start !== next || end < start || end > record.lineCount
        || String(range?.sourceSha256 ?? '') !== String(record.normalizedSha256)) {
        throw new Error('全文审阅证明不连续或来源哈希不一致')
      }
      next = end + 1
    }
    if (next !== record.lineCount + 1) throw new Error('全文审阅证明未覆盖至文件末尾')
    return true
  }
  const normalizeSourceSpan = (span, lineCount) => {
    const startLine = Number(span?.startLine)
    const endLine = Number(span?.endLine)
    if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 1 || endLine < startLine || endLine > lineCount) {
      throw new Error(`非法 sourceSpan: ${String(span?.startLine)}-${String(span?.endLine)}（有效行号 1-${lineCount}）`)
    }
    return { startLine, endLine }
  }

  const normalizeSourceSpans = (spans, lineCount) => {
    const normalized = (spans ?? [])
      .map((span) => normalizeSourceSpan(span, lineCount))
      .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine)
    for (let index = 1; index < normalized.length; index++) {
      if (normalized[index].startLine <= normalized[index - 1].endLine) {
        throw new Error(`同一 assignment 内 sourceSpans 重叠：${normalized[index - 1].startLine}-${normalized[index - 1].endLine} 与 ${normalized[index].startLine}-${normalized[index].endLine}`)
      }
    }
    return normalized
  }

  const spanFragments = (record, spans) => {
    const starts = lineStartsOf(record)
    return spans.map((span) => {
      const startOffset = starts[span.startLine - 1]
      const endOffset = span.endLine < record.lineCount ? starts[span.endLine] : record.normalizedSource.length
      const text = record.normalizedSource.slice(startOffset, endOffset)
      return {
        startLine: span.startLine,
        endLine: span.endLine,
        startOffset,
        endOffset,
        chars: text.length,
        sha256: sha256(text),
        text,
      }
    })
  }

  // Concatenate exact source fragments without inventing separator text. Each
  // non-final line fragment already owns its terminating LF.
  const spanText = (record, spans) => spanFragments(record, spans).map((fragment) => fragment.text).join('')

  const assertReferenceBudget = (record, assignments) => {
    const starts = lineStartsOf(record)
    let referencedChars = 0
    for (const assignment of assignments) {
      for (const rawSpan of assignment.sourceSpans ?? []) {
        const span = normalizeSourceSpan(rawSpan, record.lineCount)
        const startOffset = starts[span.startLine - 1]
        const endOffset = span.endLine < record.lineCount ? starts[span.endLine] : record.normalizedSource.length
        referencedChars += endOffset - startOffset
        if (referencedChars > IMPORT_LIMITS.maxReferencedChars) {
          throw new Error(`sourceSpans 引用正文总量超过上限 ${IMPORT_LIMITS.maxReferencedChars} 字符（含 secondary 复用）`)
        }
      }
    }
    return referencedChars
  }

  const sourceDescriptor = (record, assignment) => ({
    schemaVersion:1,
    importId: record.importId,
    target: assignment.target,
    sourceSpans: cloneRecord(assignment.sourceSpans),
    fragments: spanFragments(record, assignment.sourceSpans).map(({ text: _text, ...fragment }) => fragment),
    sourceSha256: assignment.sourceSha256,
    normalizedSourceSha256: record.normalizedSha256,
    ...(record.sourceEnvelope?{originalSourceSha256:record.rawSha256,format:record.sourceEnvelope.format}:{}),
    exactCopy: true,
    secondary: assignment.secondary === true,
    ...(assignment.reuse_reason ? { reuseReason: assignment.reuse_reason } : {}),
  })

  const rangesOf = (lines) => {
    const ranges = []
    for (const line of lines) {
      const last = ranges.at(-1)
      if (last && last.endLine + 1 === line) last.endLine = line
      else ranges.push({ startLine: line, endLine: line })
    }
    return ranges
  }

  const importCoverage = (record, assignments = record.assignments ?? []) => {
    if (!record || typeof record.normalizedSource !== 'string'
      || !Number.isSafeInteger(record.lineCount)
      || record.lineCount < 1 || record.lineCount > IMPORT_LIMITS.maxLines
      || record.normalizedSource.length > IMPORT_LIMITS.maxChars) {
      throw new Error('导入记录超出覆盖率计算边界')
    }
    assertAssignmentBudget(assignments)
    // A Map<line, Set<assignment>> made deliberately overlapping spans
    // O(assignments * lines) and could freeze the single Node event loop.  A
    // difference array preserves the exact same ownership semantics in
    // O(lines + spans), with bounded memory from maxLines.
    const ownershipDelta = new Int32Array(record.lineCount + 2)
    for (const assignment of assignments) {
      if (assignment.secondary === true) continue
      for (const rawSpan of assignment.sourceSpans ?? []) {
        const span = normalizeSourceSpan(rawSpan, record.lineCount)
        ownershipDelta[span.startLine] += 1
        ownershipDelta[span.endLine + 1] -= 1
      }
    }
    const starts = lineStartsOf(record)
    const lineChars = (line) => {
      const startOffset = starts[line - 1]
      const endOffset = line < record.lineCount ? starts[line] : record.normalizedSource.length
      return endOffset - startOffset
    }
    const uncovered = []
    const overlaps = []
    const totalChars = record.normalizedSource.length
    let coveredChars = 0
    let ownership = 0
    for (let line = 1; line <= record.lineCount; line++) {
      ownership += ownershipDelta[line]
      if (ownership === 0) uncovered.push(line)
      else if (ownership > 1) overlaps.push(line)
      else coveredChars += lineChars(line)
    }
    return {
      sourceLines: record.lineCount,
      coveredLines: record.lineCount - uncovered.length - overlaps.length,
      sourceChars: totalChars,
      coveredChars,
      coverage: totalChars === 0 ? 1 : coveredChars / totalChars,
      uncovered,
      overlaps,
      uncoveredRanges: rangesOf(uncovered),
      overlapRanges: rangesOf(overlaps),
    }
  }

  const assignmentIdentity = (assignment) => {
    if (assignment.target === 'card') return `card:${assignment.kind === 'user' ? 'user' : assignment.id}`
    if (assignment.target === 'worldbook') return `worldbook:${assignment.id}`
    return null
  }

  const validateAssignmentIdentities = (assignments) => {
    const seen = new Map()
    for (const assignment of assignments) {
      const identity = assignmentIdentity(assignment)
      if (!identity) continue
      const previous = seen.get(identity)
      if (!previous) {
        seen.set(identity, assignment)
        continue
      }
      const mergeGroup = String(assignment.merge_group ?? '')
      if (!mergeGroup || mergeGroup !== String(previous.merge_group ?? '')) {
        throw new Error(`重复导入目标 ${identity}；请把离散范围合并到同一 assignment.sourceSpans，或为确需合并的条目设置相同 merge_group`)
      }
    }
  }

  const parseRegexRules = (sourceText) => {
    const raw = String(sourceText ?? '').trim()
    const fenced = [...raw.matchAll(/```(?:json|javascript|js)?\s*\n([\s\S]*?)```/gi)]
      .map((match) => match[1].trim())
    const candidates = [...fenced, raw]
    let parsed
    let parseError
    for (const candidate of candidates) {
      try {
        parsed = JSON.parse(candidate)
        break
      } catch (error) {
        parseError = error
      }
    }
    if (parsed === undefined) {
      throw new Error(`beauty-regex 来源必须是原卡中的 JSON/JSON fenced code：${String(parseError?.message ?? '无法解析')}`)
    }
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.regexRules) ? parsed.regexRules : [parsed]
    if (!list.length || list.length > 200) throw new Error('beauty-regex 必须包含 1-200 条规则')
    return list.map((rule, index) => {
      const match = typeof rule?.match === 'string' ? rule.match : ''
      if (typeof rule?.replace !== 'string') throw new Error(`beauty-regex 第 ${index + 1} 条缺少字符串 replace`)
      const replace = rule.replace
      if (!match) throw new Error(`beauty-regex 第 ${index + 1} 条缺少 match`)
      if (match.length > 4096 || replace.length > 65536) throw new Error(`beauty-regex 第 ${index + 1} 条过长`)
      try {
        new RegExp(match, 'g')
      } catch (error) {
        throw new Error(`beauty-regex 第 ${index + 1} 条不是合法 JavaScript 正则：${String(error?.message ?? error)}`)
      }
      return { match, replace }
    })
  }

  const verifyWrite = (write) => {
    const actual = write.table.get(write.key)
    if (write.next === undefined) return actual === undefined
    return recordSha256(actual) === recordSha256(write.next)
  }

  const restoreImportTransaction = async (sessionId, key, record) => {
    const transaction = record?.transaction
    if (!transaction || !Array.isArray(transaction.writes)
      || transaction.writes.length > IMPORT_LIMITS.maxAssignments * 4) {
      throw new Error('导入处于 committing/recovery-required，但缺少可恢复事务日志')
    }
    const failures = []
    for (const item of [...transaction.writes].reverse()) {
      if (!item || typeof item.key !== 'string' || typeof item.tableName !== 'string') {
        failures.push('事务日志包含无效写入项')
        continue
      }
      const table = importTableByName[item.tableName]
      if (!table) {
        failures.push(`未知表 ${item.tableName}`)
        continue
      }
      try {
        const before = table.get(item.key)
        const beforeDigest = recordSha256(before)
        const prevDigest = item.prevExists ? recordSha256(item.prev) : 'missing'
        // Only undo our own value.  If another writer changed this key after
        // the partial activation, fail closed instead of destroying it.
        if (beforeDigest !== prevDigest && beforeDigest !== item.nextSha256) {
          failures.push(`${item.tableName}:${item.key} 已被其他写入修改，拒绝破坏性回滚`)
          continue
        }
        if (beforeDigest !== prevDigest) {
          if (item.prevExists) await table.put(item.key, cloneRecord(item.prev))
          else await table.delete(item.key)
        }
        const actual = table.get(item.key)
        const restored = item.prevExists
          ? recordSha256(actual) === recordSha256(item.prev)
          : actual === undefined
        if (!restored) failures.push(`${item.tableName}:${item.key} 恢复后校验失败`)
      } catch (error) {
        failures.push(`${item.tableName}:${item.key}: ${String(error?.message ?? error)}`)
      }
    }
    try {
      const pointerKey = importActiveKey(sessionId)
      const currentPointer = T.branch.get(pointerKey)
      const beforeDigest = recordSha256(currentPointer)
      const prevDigest = transaction.activePointerPrevExists
        ? recordSha256(transaction.activePointerPrev)
        : 'missing'
      const ownedByTransaction = currentPointer?.transactionId === transaction.transactionId
      if (beforeDigest !== prevDigest && !ownedByTransaction) {
        failures.push('active pointer 已被其他事务修改，拒绝破坏性回滚')
      } else if (beforeDigest !== prevDigest) {
        if (transaction.activePointerPrevExists) {
          await T.branch.put(pointerKey, cloneRecord(transaction.activePointerPrev))
        } else {
          await T.branch.delete(pointerKey)
        }
      }
      const actualPointer = T.branch.get(pointerKey)
      const pointerRestored = transaction.activePointerPrevExists
        ? recordSha256(actualPointer) === recordSha256(transaction.activePointerPrev)
        : actualPointer === undefined
      if (!pointerRestored) failures.push('active pointer 恢复后校验失败')
    } catch (error) {
      failures.push(`active pointer: ${String(error?.message ?? error)}`)
    }
    const staging = cloneRecord(record)
    staging.status = 'staging'
    staging.recoveredAt = Date.now()
    delete staging.transaction
    delete staging.recoveryErrors
    if (!failures.length) {
      try {
        await T.branch.put(key, staging)
        if (recordSha256(T.branch.get(key)) !== recordSha256(staging)) failures.push('staging import record 恢复后校验失败')
      } catch (error) {
        failures.push(`staging import record: ${String(error?.message ?? error)}`)
      }
    }
    if (failures.length) {
      const failed = { ...staging, status: 'recovery-required', transaction, recoveryErrors: failures }
      try { await T.branch.put(key, failed) } catch {}
      throw new Error(`角色卡导入回滚不完整，禁止继续激活：${failures.join('; ')}`)
    }
    return staging
  }

  const importSummary = (record) => {
    assertImportRecordIntegrity(record)
    const coverage = importCoverage(record)
    return {
      importId: record.importId,
      sourceFile: record.sourceFile,
      mode: record.mode ?? 'replace',
      status: record.status,
      rawSha256: record.rawSha256,
      normalizedSha256: record.normalizedSha256,
      rawChars: record.rawChars,
      normalizedChars: record.normalizedChars,
      lineCount: record.lineCount,
      reviewComplete: record.reviewComplete === true,
      nextReadCursor: record.nextReadCursor ?? null,
      assignmentCount: (record.assignments ?? []).length,
      coverage: coverage.coverage,
      coveredLines: coverage.coveredLines,
      sourceLines: coverage.sourceLines,
      coveredChars: coverage.coveredChars,
      sourceChars: coverage.sourceChars,
      createdAt: record.createdAt,
      activatedAt: record.activatedAt ?? null,
      ...(record.sourceEnvelope ? {format:record.sourceEnvelope.format, suggestedMapping:true,
        warnings:record.sourceEnvelope.warnings} : {}),
    }
  }

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_card_import_begin',
        '开始无损读卡导入。直接读取 ST/TauriTavern PNG/JSON，或 Markdown/TXT；保留原件、字段来源与哈希。PNG/JSON 不经过 anydoc。返回 import_id、行数和审阅入口。',
        {
          type: 'object',
          properties: {
            source_file: { type: 'string' },
            mode: { type: 'string', enum: ['replace', 'merge'], description: '完整新卡默认 replace；仅明确导入补充包时使用 merge' },
          },
          required: ['source_file'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          const requestedPath = String(args.source_file ?? '').trim()
          if (!requestedPath) return { ok: false, error: 'source_file 不能为空' }
          if(!eventsOf(exec.agent?.session).some(e=>e.type==='subagent/descriptor')) {
            let job
            try{job=await beginCardWorkflow(session,'card-import',requestedPath,exec.agent)}catch(error){return {ok:false,error:String(error.message)}}
            if(job.execution==='spawn') {
              try{await resumeCardWorkflows(session,exec.agent,exec.signal)}catch(error){if(!isInlinePending(error))throw error}
              return {ok:true,job:T.branch.get(cardWorkflowKey(job.id)),pending:true}
            }
          }
          const workflow=activeCardWorkflow(session)
          if(workflow?.kind==='card-import' && resolve(session.header.cwd,requestedPath)!==workflow.source.sourceFile)return {ok:false,error:'任务只能读取已冻结的角色卡文件'}
          const resumed=workflow?[...T.branch.entries()].map(([,v])=>v).find(v=>v?.workflowId===workflow.id&&v.importId):null
          if(resumed)return {ok:true,...importSummary(resumed),resumed:true}
          let source
          try {
            source = resolveImportSource(session, requestedPath)
          } catch (error) {
            return { ok: false, error: String(error?.message ?? error) }
          }
          if (source.sourceBytes > IMPORT_LIMITS.maxBytes) return { ok: false, error: `角色卡超过 ${IMPORT_LIMITS.maxBytes.toLocaleString()} 字节，拒绝静默截断；请先拆成多个来源文件` }
          // Read bytes first so the recorded byte count describes exactly the
          // archived source, not a possibly changed file observed by stat().
          const rawBytes = source.bytes
          if (rawBytes.length > IMPORT_LIMITS.maxBytes) return { ok: false, error: `角色卡超过 ${IMPORT_LIMITS.maxBytes.toLocaleString()} 字节，拒绝静默截断；请先拆成多个来源文件` }
          let decoded, projected
          try {
            if (['.png','.json'].includes(source.extension)) {
              decoded = decodeTavernCard(rawBytes, source.extension)
              projected = projectTavernCard(decoded)
            }
          } catch (error) { return {ok:false,error:String(error.message)} }
          const rawSource = decoded ? JSON.stringify(decoded.document,null,2) : rawBytes.toString('utf8')
          if (!decoded && !Buffer.from(rawSource, 'utf8').equals(rawBytes)) return { ok: false, error: '角色卡不是有效 UTF-8；拒绝以替换字符损坏原文' }
          if (rawSource.length > IMPORT_LIMITS.maxChars) return { ok: false, error: `角色卡超过 ${IMPORT_LIMITS.maxChars.toLocaleString()} 字符，拒绝静默截断；请先拆成多个来源文件` }
          const normalizedSource = projected?.text ?? deescapeMarkdown(rawSource).replace(/\r\n?/g, '\n')
          if (normalizedSource.length > IMPORT_LIMITS.maxChars) return {ok:false,error:'角色卡投影超过字符上限；拒绝静默截断'}
          if (!normalizedSource.trim()) return { ok: false, error: '角色卡规范化后没有任何有效内容，拒绝创建空导入' }
          const importId = randomUUID()
          const splitLines = normalizedSource.split('\n')
          const lineCount = splitLines.length - (normalizedSource.endsWith('\n') ? 1 : 0)
          if (lineCount < 1 || lineCount > IMPORT_LIMITS.maxLines) return { ok: false, error: `角色卡行数超过上限 ${IMPORT_LIMITS.maxLines.toLocaleString()}` }
          const lines = splitLines.slice(0, lineCount)
          const lineStarts = []
          let offset = 0
          for (let index = 0; index < lineCount; index++) {
            lineStarts.push(offset)
            offset += lines[index].length + (index < lineCount - 1 || normalizedSource.endsWith('\n') ? 1 : 0)
          }
          const headings = lines
            .map((line, index) => ({ line: index + 1, text: line.trim() }))
            .filter((entry) => /^(?:#{1,6}\s+|={2,}.+={2,}$|【.+】$)/.test(entry.text))
            .slice(0, 200)
          const record = {
            schemaVersion: decoded ? 4 : 3,
            importId,
            workflowId:workflow?.id,
            workflowGeneration:workflow?.generation,
            sessionId: session.id,
            sourceFile: source.sourcePath,
            workspaceRoot: source.workspaceRoot,
            sourceBytes: rawBytes.length,
            sourceMtimeMs: source.sourceMtimeMs,
            normalizer: decoded ? 'tavern-fields-v1' : IMPORT_NORMALIZER,
            ...(decoded ? { sourceEnvelope:{schemaVersion:1, extension:source.extension, format:decoded.format,
              base64:rawBytes.toString('base64'), sourceSha256:decoded.sourceSha256, warnings:projected.warnings} } : {}),
            mode: args.mode === 'merge' ? 'merge' : 'replace',
            rawSource,
            normalizedSource,
            lines,
            lineStarts,
            rawSha256: sha256(rawBytes),
            normalizedSha256: sha256(normalizedSource),
            rawChars: rawSource.length,
            normalizedChars: normalizedSource.length,
            lineCount,
            headings,
            assignments: [],
            readRanges: [],
            nextReadCursor: 1,
            reviewComplete: false,
            status: 'staging',
            createdAt: Date.now(),
          }
          await T.branch.put(importRecordKey(session.id, importId), record)
          return { ok: true, ...importSummary(record), headings, nextCursor: 1 }
        }
      )
    ),
    'roleplay: tool rp_card_import_begin'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_card_import_chunk',
        '按行分页读取已归档角色卡原文。首次审阅必须严格按 nextCursor 从 1 连续读到 null；完成后可按任意合法 cursor 复查。',
        {
          type: 'object',
          properties: {
            import_id: { type: 'string' },
            cursor: { type: 'number' },
            max_lines: { type: 'number' },
          },
          required: ['import_id', 'cursor'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          return withImportLock(session.id, args.import_id, async () => {
            const key = importRecordKey(session.id, args.import_id)
            const record = T.branch.get(key)
            if (!record) return { ok: false, error: 'import_id 不存在' }
            try { assertImportRecordIntegrity(record) }
            catch (error) { return { ok: false, recoveryRequired: true, error: String(error?.message ?? error) } }
            if (!['staging', 'active'].includes(record.status)) {
              return { ok: false, error: `import 当前状态为 ${String(record.status)}，必须先完成恢复` }
            }
            const start = Math.floor(Number(args.cursor))
            if (!Number.isSafeInteger(start) || start < 1 || start > record.lineCount) {
              return { ok: false, error: `cursor 必须是 1-${record.lineCount} 的整数` }
            }
            const maxLines = Math.min(300, Math.max(20, Math.floor(Number(args.max_lines) || 160)))
            const end = Math.min(record.lineCount, start + maxLines - 1)
            const priorRead = (record.readRanges ?? []).find((range) => range.startLine === start && range.endLine === end)
            const historicalRetry = record.status === 'staging' && record.reviewComplete !== true && start !== record.nextReadCursor && priorRead
            if (record.status === 'staging' && record.reviewComplete !== true && start !== record.nextReadCursor && !historicalRetry) {
              return { ok: false, error: `首次审阅不得跳页；下一块必须从 cursor=${record.nextReadCursor} 开始` }
            }
            const responseNextCursor = historicalRetry
              ? record.nextReadCursor
              : end < record.lineCount ? end + 1 : null
            let saved = record
            if (record.status === 'staging' && record.reviewComplete !== true && !historicalRetry) {
              saved = cloneRecord(record)
              saved.readRanges = [...(record.readRanges ?? []), { startLine: start, endLine: end, sourceSha256: record.normalizedSha256, readAt: Date.now() }]
              saved.nextReadCursor = responseNextCursor
              saved.reviewComplete = responseNextCursor === null
              saved.updatedAt = Date.now()
              await T.branch.put(key, saved)
            }
            const numberedText = record.lines
              .slice(start - 1, end)
              .map((line, index) => `${start + index}\t${line}`)
              .join('\n')
            return {
              ok: true,
              importId: record.importId,
              startLine: start,
              endLine: end,
              numberedText: fenceCardContent(numberedText, 'source'),
              nextCursor: responseNextCursor,
              reviewComplete: saved.reviewComplete === true,
              normalizedSha256: record.normalizedSha256,
            }
          })
        }
      )
    ),
    'roleplay: tool rp_card_import_chunk'
  )

  const IMPORT_TARGETS = new Set([
    'card', 'worldbook', 'status', 'core-setting', 'plot-guidance', 'rule-narrative', 'rule-reply', 'rule-style',
    'opening', 'beauty-css', 'beauty-js', 'beauty-regex', 'archive-only',
  ])
  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_card_import_stage',
        '提交角色卡分类元数据与原文行跨度。必须先读完全文；同时通过 resource_title 给资源库起一个体现整本书主题、方便辨认的名称，不使用 UUID 或乱码原文件名；这不是修改角色名字。禁止传 content/正则正文，后端只从 sourceSpans 原样物化。可分批追加，纠错时 replace_all=true。\n'+CARD_CLASSIFICATION_GUIDE,
        {
          type: 'object',
          properties: {
            import_id: { type: 'string' },
            resource_title: { type: 'string', maxLength: 90, description: 'LLM 读完后给整本书起的主题名称，不含扩展名；仅影响资源显示和下载文件名，原卡字节与人设不变。' },
            replace_all: { type: 'boolean' },
            use_suggested: { type: 'boolean', description:'仅当 PNG/JSON 完整审阅确认字段分类符合语义时设 true；字段混合多个模块时用 assignments 细分完整原文跨度。' },
            assignments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  target: { type: 'string', enum: [...IMPORT_TARGETS], description: '人物用 card；常驻世界基础、核心威胁和长期矛盾用 core-setting；路线、触发条件与可能结局用 plot-guidance（不是已发生剧情）；被动可查的地点/势力/概念条目用 worldbook；状态模板用 status；叙事/回复/文风要求与完整写作样本分别用 rule-narrative/rule-reply/rule-style；开场用 opening；美化用 beauty-css/beauty-js/beauty-regex；其余原文用 archive-only。不得把完整样本压缩为风格关键词。' },
                  id: { type: 'string' }, name: { type: 'string' }, kind: { type: 'string' },
                  locked: { type: 'boolean' }, secondary: { type: 'boolean' }, aliases: { type: 'array', items: { type: 'string' } },
                  keywords: { type: 'array', items: { type: 'string' } }, triggers: { type: 'array', items: { type: 'string' } },
                  priority: { type: 'number' }, token_budget: { type: 'number' }, always_on: { type: 'boolean' },
                  order: { type: 'number' }, merge_group: { type: 'string' }, reuse_reason: { type: 'string' },
                  sourceSpans: { type: 'array', items: { type: 'object', properties: { startLine: { type: 'number' }, endLine: { type: 'number' } }, required: ['startLine', 'endLine'], additionalProperties: false } },
                },
                required: ['target', 'sourceSpans'],
                additionalProperties: false,
              },
            },
          },
          required: ['import_id'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          return withImportLock(session.id, args.import_id, async () => {
            const key = importRecordKey(session.id, args.import_id)
            const record = T.branch.get(key)
            if (!record || record.status !== 'staging') return { ok: false, error: 'import_id 不存在或已结束 staging' }
            try { assertImportRecordIntegrity(record) }
            catch (error) { return { ok: false, recoveryRequired: true, error: String(error?.message ?? error) } }
            try { assertReviewProof(record) }
            catch (error) { return { ok: false, error: String(error?.message ?? error) } }
            const incoming = []
            try {
              if (args.use_suggested === true) {
                if (!record.sourceEnvelope) throw new Error('只有结构化 PNG/JSON 原件支持建议映射')
                const decoded = decodeTavernCard(Buffer.from(record.sourceEnvelope.base64,'base64'), record.sourceEnvelope.extension)
                args = {...args, replace_all:true, assignments:projectTavernCard(decoded).assignments}
              }
              if (!Array.isArray(args.assignments)) throw new Error('assignments 必须是数组')
              // Validate aggregate payload size before slicing/hashing spans;
              // otherwise thousands of repeated whole-card secondary spans can
              // monopolize the process even though their count is bounded.
              assertAssignmentBudget(args.assignments)
              assertReferenceBudget(record, args.assignments)
              for (const raw of args.assignments ?? []) {
                const target = String(raw.target ?? '')
                if (!IMPORT_TARGETS.has(target)) return { ok: false, error: `未知 target: ${target}` }
                const sourceSpans = normalizeSourceSpans(raw.sourceSpans, record.lineCount)
                if (!sourceSpans.length) return { ok: false, error: `${target} 缺少 sourceSpans` }
                const secondary = raw.secondary === true
                const reuseReason = String(raw.reuse_reason ?? '').trim()
                if (secondary && target === 'archive-only') return { ok: false, error: 'archive-only 不能标记为 secondary' }
                if (secondary && !reuseReason) return { ok: false, error: `${target} 的 secondary 复用必须填写 reuse_reason` }
                let id
                let kind = raw.kind === undefined ? undefined : String(raw.kind)
                if (target === 'card') {
                  kind = kind === 'user' ? 'user' : 'npc'
                  id = kind === 'user' ? 'user' : stableImportId(raw.id ?? raw.name)
                } else if (target === 'worldbook') {
                  id = stableImportId(raw.id ?? raw.name)
                } else if (raw.id !== undefined) {
                  id = stableImportId(raw.id)
                }
                const finiteNumber = (value, fallback, minimum, maximum) => {
                  const parsed = Number(value)
                  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
                }
                const assignment = {
                  target,
                  ...(id ? { id } : {}),
                  ...(raw.name === undefined ? {} : { name: String(raw.name).trim() }),
                  ...(kind === undefined ? {} : { kind }),
                  locked: raw.locked === true,
                  secondary,
                  ...(reuseReason ? { reuse_reason: reuseReason } : {}),
                  ...(raw.merge_group === undefined ? {} : { merge_group: String(raw.merge_group).trim() }),
                  aliases: Array.isArray(raw.aliases) ? raw.aliases.map(String) : [],
                  keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : [],
                  triggers: Array.isArray(raw.triggers) ? raw.triggers.map(String) : [],
                  priority: finiteNumber(raw.priority, 0, -1_000_000, 1_000_000),
                  token_budget: finiteNumber(raw.token_budget, 0, 0, 10_000_000),
                  always_on: raw.always_on === true,
                  order: finiteNumber(raw.order, sourceSpans[0].startLine, -1_000_000_000, 1_000_000_000),
                  sourceSpans,
                  sourceSha256: sha256(spanText(record, sourceSpans)),
                  stagedAt: Date.now(),
                }
                incoming.push(assignment)
              }
              const assignments = args.replace_all === true ? incoming : [...(record.assignments ?? []), ...incoming]
              assertAssignmentBudget(assignments)
              assertReferenceBudget(record, assignments)
              validateAssignmentIdentities(assignments)
              const resourceTitle=args.resource_title===undefined?record.resourceTitle:String(args.resource_title).normalize('NFC').trim()
              if(args.resource_title!==undefined&&(!resourceTitle||resourceTitle.length>90))throw new Error('资源主题名称需为 1 至 90 字符')
              const next = { ...cloneRecord(record), assignments, ...(resourceTitle?{resourceTitle}:{}), updatedAt: Date.now() }
              await T.branch.put(key, next)
              const coverage = importCoverage(next)
              return {
                ok: true,
                importId: next.importId,
                assignmentCount: next.assignments.length,
                coverage: coverage.coverage,
                coveredLines: coverage.coveredLines,
                sourceLines: coverage.sourceLines,
                coveredChars: coverage.coveredChars,
                sourceChars: coverage.sourceChars,
                uncoveredRanges: coverage.uncoveredRanges.slice(0, 40),
                overlapRanges: coverage.overlapRanges.slice(0, 40),
              }
            } catch (error) {
              return { ok: false, error: String(error?.message ?? error) }
            }
          })
        }
      )
    ),
    'roleplay: tool rp_card_import_stage'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_card_import_finalize',
        '校验全文已审阅、原文字符 100% 已分类后以回滚日志激活；遗漏、主归属重叠、跨度哈希变化或写后校验失败都会拒绝提交。',
        {
          type: 'object',
          properties: {
            import_id: { type: 'string' },
            expected_sha256: { type: 'string' },
          },
          required: ['import_id', 'expected_sha256'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          return withImportLock(session.id, args.import_id, async () => {
            const key = importRecordKey(session.id, args.import_id)
            let record = T.branch.get(key)
            if (!record) return { ok: false, error: 'import_id 不存在' }
            try { assertImportRecordIntegrity(record) }
            catch (error) { return { ok: false, recoveryRequired: true, error: String(error?.message ?? error) } }
            if (record.status === 'active') {
              if (String(args.expected_sha256).toLowerCase() !== String(record.normalizedSha256).toLowerCase()) {
                return { ok: false, error: 'import_id 已激活，但 expected_sha256 不匹配' }
              }
              const pointer = T.branch.get(importActiveKey(session.id))
              if (pointer?.importId !== record.importId) {
                return { ok: true, idempotent: true, current: false, ...importSummary(record), ...(record.activation?.summary ?? {}) }
              }
              if (!record.activation || typeof record.activation.transactionId !== 'string'
                || !Array.isArray(record.activation.writeDigests) || record.activation.writeDigests.length === 0) {
                return { ok: false, recoveryRequired: true, error: 'active import record 缺少完整激活证明' }
              }
              if (pointer?.normalizedSha256 !== record.normalizedSha256
                || pointer?.transactionId !== record.activation.transactionId) {
                return { ok: false, recoveryRequired: true, error: '活动导入指针与 active import record 不一致' }
              }
              try {
                assertAssignmentBudget(record.assignments ?? [])
                assertReferenceBudget(record, record.assignments ?? [])
                validateAssignmentIdentities(record.assignments ?? [])
                for (const assignment of record.assignments ?? []) {
                  const normalized = normalizeSourceSpans(assignment.sourceSpans, record.lineCount)
                  if (stableJson(normalized) !== stableJson(assignment.sourceSpans)) throw new Error('active sourceSpans 非规范')
                  const digest = sha256(spanText(record, normalized))
                  if (digest !== assignment.sourceSha256 || digest !== assignment.materializedSha256) {
                    throw new Error(`${assignment.target} 的 active 来源哈希不一致`)
                  }
                }
              } catch (error) {
                return { ok: false, recoveryRequired: true, error: String(error?.message ?? error) }
              }
              const currentCoverage = importCoverage(record)
              if (pointer?.coverageSha256 !== recordSha256(currentCoverage)
                || (record.coverage !== undefined && recordSha256(record.coverage) !== recordSha256(currentCoverage))) {
                return { ok: false, recoveryRequired: true, error: '活动导入覆盖率证明与当前 assignments 不一致' }
              }
              for (const digest of record.activation.writeDigests) {
                const table = importTableByName[digest.tableName]
                if (!table || recordSha256(table.get(digest.key)) !== digest.sha256) {
                  return { ok: false, recoveryRequired: true, error: `已激活材料校验失败：${digest.tableName}:${digest.key}` }
                }
              }
              return { ok: true, idempotent: true, current: true, ...importSummary(record), ...(record.activation?.summary ?? {}) }
            }
            if (record.status === 'committing' || record.status === 'recovery-required') {
              try {
                record = await restoreImportTransaction(session.id, key, record)
              } catch (error) {
                return { ok: false, recoveryRequired: true, error: String(error?.message ?? error) }
              }
            }
            if (record.status !== 'staging') return { ok: false, error: `import 当前状态为 ${String(record.status)}，不能激活` }
            if (![3,4].includes(record.schemaVersion)) return { ok: false, error: '旧版 staging 记录缺少全文审阅证明；请重新执行 rp_card_import_begin' }
            try {
              assertAssignmentBudget(record.assignments ?? [])
              assertReferenceBudget(record, record.assignments ?? [])
              // Re-normalize from the durable record at the commit boundary;
              // a hand-edited/corrupt record must never reach spanText().
              for (const assignment of record.assignments ?? []) {
                const normalized = normalizeSourceSpans(assignment.sourceSpans, record.lineCount)
                if (stableJson(normalized) !== stableJson(assignment.sourceSpans)) {
                  throw new Error('sourceSpans 未按规范排序或包含重复跨度')
                }
              }
            } catch (error) {
              return { ok: false, recoveryRequired: true, error: String(error?.message ?? error) }
            }
            try { assertReviewProof(record) }
            catch (error) { return { ok: false, recoveryRequired: true, error: String(error?.message ?? error) } }
            if (String(args.expected_sha256).toLowerCase() !== String(record.normalizedSha256).toLowerCase()) {
              return { ok: false, error: '来源 SHA-256 不匹配，拒绝对变化后的原卡提交旧分类' }
            }
            if (sha256(record.normalizedSource) !== record.normalizedSha256) {
              return { ok: false, error: '归档原文完整性校验失败，拒绝激活' }
            }
            if (!(record.assignments ?? []).some((assignment) => assignment.target !== 'archive-only')) {
              return { ok: false, error: '全部原文均被归入 archive-only；至少需要一个可用角色卡/世界书/规则/开场栏目' }
            }
            try {
              validateAssignmentIdentities(record.assignments ?? [])
              for (const assignment of record.assignments ?? []) {
                const materializedSha256 = sha256(spanText(record, assignment.sourceSpans))
                if (materializedSha256 !== assignment.sourceSha256) {
                  return { ok: false, error: `${assignment.target} 的 sourceSpans 哈希已变化，拒绝激活` }
                }
              }
            } catch (error) {
              return { ok: false, error: String(error?.message ?? error) }
            }
            const coverage = importCoverage(record)
            if (coverage.uncovered.length || coverage.overlaps.length || coverage.coveredChars !== coverage.sourceChars) {
              return {
                ok: false,
                error: `导入覆盖率 ${(coverage.coverage * 100).toFixed(2)}%，未达到原文字符 100%`,
                uncoveredRanges: coverage.uncoveredRanges.slice(0, 200),
                overlapRanges: coverage.overlapRanges.slice(0, 200),
                coveredChars: coverage.coveredChars,
                sourceChars: coverage.sourceChars,
              }
            }

            // Materialize in source order. `order` is descriptive metadata and
            // must not let the model rearrange the author's paragraphs inside
            // a card/rule/status/opening assembled from multiple assignments.
            const assignments = [...record.assignments]
              .sort((left, right) => left.sourceSpans[0].startLine - right.sourceSpans[0].startLine || Number(left.order) - Number(right.order))
            const cards = new Map()
            const worldbook = new Map()
            const rules = Object.fromEntries(RULE_TEXT_FIELDS.map(field=>[field,[]]))
            const ruleSources = Object.fromEntries(RULE_TEXT_FIELDS.map(field=>[field,[]]))
            const status = []
            const statusSources = []
            const opening = []
            const openingSources = []
            const archiveSources = []
            const beauty = { css: [], js: [], regexRules: [], sources: [] }
            const tavernProjection = record.sourceEnvelope
              ? projectTavernCard(decodeTavernCard(Buffer.from(record.sourceEnvelope.base64,'base64'),record.sourceEnvelope.extension)) : null
            try {
              for (const assignment of assignments) {
                const content = spanText(record, assignment.sourceSpans)
                const source = sourceDescriptor(record, assignment)
                if (assignment.target === 'card') {
                  const id = assignment.kind === 'user' ? 'user' : assignment.id
                  const list = cards.get(id) ?? []
                  list.push({ ...assignment, content, source })
                  cards.set(id, list)
                } else if (assignment.target === 'worldbook') {
                  const list = worldbook.get(assignment.id) ?? []
                  list.push({ ...assignment, content, source })
                  worldbook.set(assignment.id, list)
                } else if (assignment.target === 'status') {
                  status.push({ ...assignment, content })
                  statusSources.push(source)
                } else if (RULE_IMPORT_FIELDS[assignment.target]) {
                  const field=RULE_IMPORT_FIELDS[assignment.target]
                  rules[field].push({ ...assignment, content })
                  ruleSources[field].push(source)
                } else if (assignment.target === 'opening') {
                  opening.push({ ...assignment, content })
                  openingSources.push(source)
                } else if (assignment.target === 'beauty-css') {
                  const cssSyntax=content.replace(/\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,'')
                  if(/<\/?(?:section|div|article|aside|main|table|details|span|p|body|html|svg|script)\b[^>]*>/i.test(cssSyntax))throw new Error('beauty-css 包含 HTML 结构。状态栏模板及配套 CSS 必须归入 status；请调整 sourceSpans 分类后重新 finalize，原文不能改写。')
                  beauty.css.push({ ...assignment, content })
                  beauty.sources.push({ kind: 'css', ...source })
                } else if (assignment.target === 'beauty-js') {
                  beauty.js.push({ ...assignment, content })
                  beauty.sources.push({ kind: 'js', ...source })
                } else if (assignment.target === 'beauty-regex') {
                  const parsed = parseRegexRules(content)
                  beauty.regexRules.push(...parsed.map((rule) => ({ ...rule, source })))
                  beauty.sources.push({ kind: 'regex', ...source })
                } else if (assignment.target === 'archive-only') {
                  archiveSources.push({ ...source, ...(assignment.name ? { name: assignment.name } : {}) })
                }
              }
            } catch (error) {
              return { ok: false, error: String(error?.message ?? error) }
            }

            const writes = []
            const writeKeys = new Set()
            const addWrite = (tableName, entryKey, next) => {
              const table = importTableByName[tableName]
              const identity = `${tableName}:${entryKey}`
              if (!table || writeKeys.has(identity)) throw new Error(`重复事务写目标：${identity}`)
              writeKeys.add(identity)
              writes.push({
                tableName,
                table,
                key: entryKey,
                prev: cloneRecord(table.get(entryKey)),
                next: cloneRecord(next),
              })
            }
            // An assignment may itself contain multiple non-contiguous spans.
            // Sorting assignments by their first span is insufficient when
            // another assignment is interleaved between two of those spans;
            // flatten and sort every fragment so the materialized text always
            // follows the author's source order.
            const joinImported = (parts) => parts
              .flatMap((part, partIndex) => {
                if (typeof part === 'string') return [{ startLine: partIndex, endLine: partIndex, text: part }]
                return (part?.sourceSpans ?? []).map((span, spanIndex) => ({
                  startLine: span.startLine,
                  endLine: span.endLine,
                  partIndex,
                  spanIndex,
                  text: spanText(record, [span]),
                }))
              })
              .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine || left.partIndex - right.partIndex || left.spanIndex - right.spanIndex)
              .map((part) => part.text)
              .join('')
            const mergeText = (previous, added) => {
              const before = String(previous ?? '')
              const after = String(added ?? '')
              if (!before) return after
              if (!after) return before
              return `${before}${before.endsWith('\n') || after.startsWith('\n') ? '' : '\n'}${after}`
            }
            const mergeUniqueStrings = (...groups) => [...new Set(groups.flat().filter((value) => value !== undefined && value !== null).map(String))]
            const atSeq = lastSeq(session)
            const replaceMode = record.mode !== 'merge'
            try {
              for (const [id, pieces] of cards) {
                const entryKey = keyOf(session.id, id)
                const prev = cloneRecord(T.cards.get(entryKey))
                const importedContent = joinImported(pieces)
                const importedSources = pieces.map((piece) => piece.source)
                addWrite('cards', entryKey, {
                  schemaVersion: 1,
                  ...(replaceMode ? {} : prev ?? {}),
                  id,
                  name: String(pieces[0]?.name || prev?.name || id),
                  kind: pieces[0]?.kind === 'user' ? 'user' : 'npc',
                  content: replaceMode ? importedContent : mergeText(prev?.content, importedContent),
                  locked: (!replaceMode && prev?.locked === true) || pieces.some((piece) => piece.locked === true),
                  version: (Number(prev?.version) || 0) + 1,
                  updatedAtSeq: atSeq,
                  importId: record.importId,
                  sources: replaceMode ? importedSources : [...(prev?.sources ?? []), ...importedSources],
                  // In merge mode the new fragment is source-verified, but it
                  // cannot retroactively certify pre-existing agent-authored
                  // text that had no source provenance.
                  verified: replaceMode || !prev || prev.verified === true,
                })
              }
              for (const [id, pieces] of worldbook) {
                const entryKey = keyOf(session.id, id)
                const prev = cloneRecord(T.worldbook.get(entryKey))
                const first = pieces[0] ?? {}
                const importedContent = joinImported(pieces)
                const importedSources = pieces.map((piece) => piece.source)
                addWrite('worldbook', entryKey, {
                  schemaVersion: 1,
                  ...(replaceMode ? {} : prev ?? {}),
                  id,
                  kind: first.kind || prev?.kind || 'term',
                  name: String(first.name || prev?.name || id),
                  aliases: mergeUniqueStrings(replaceMode ? [] : prev?.aliases ?? [], pieces.flatMap((piece) => piece.aliases ?? [])),
                  keywords: mergeUniqueStrings(replaceMode ? [] : prev?.keywords ?? [], pieces.flatMap((piece) => piece.keywords ?? [])),
                  triggers: mergeUniqueStrings(replaceMode ? [] : prev?.triggers ?? [], pieces.flatMap((piece) => piece.triggers ?? [])),
                  priority: Math.max(replaceMode ? 0 : Number(prev?.priority) || 0, ...pieces.map((piece) => Number(piece.priority) || 0)),
                  tokenBudget: Math.max(replaceMode ? 0 : Number(prev?.tokenBudget) || 0, ...pieces.map((piece) => Number(piece.token_budget) || 0), 400),
                  alwaysOn: (!replaceMode && prev?.alwaysOn === true) || pieces.some((piece) => piece.always_on === true),
                  content: replaceMode ? importedContent : mergeText(prev?.content, importedContent),
                  locked: (!replaceMode && prev?.locked === true) || pieces.some((piece) => piece.locked === true),
                  version: (Number(prev?.version) || 0) + 1,
                  updatedAtSeq: atSeq,
                  importId: record.importId,
                  sources: replaceMode ? importedSources : [...(prev?.sources ?? []), ...importedSources],
                  ...(tavernProjection?.worldbook.find(e=>e.id===id) ? {
                    enabled:tavernProjection.worldbook.find(e=>e.id===id).enabled,
                    tavern:tavernProjection.worldbook.find(e=>e.id===id),
                  } : {}),
                  verified: replaceMode || !prev || prev.verified === true,
                })
              }
              if (replaceMode) {
                const prefix = `${session.id}__`
                for (const [existingKey, existing] of T.cards.entries()) {
                  if (!existingKey.startsWith(prefix) || !existing) continue
                  if (!cards.has(existingKey.slice(prefix.length))) addWrite('cards', existingKey, undefined)
                }
                for (const [existingKey, existing] of T.worldbook.entries()) {
                  if (!existingKey.startsWith(prefix) || !existing) continue
                  if (!worldbook.has(existingKey.slice(prefix.length))) addWrite('worldbook', existingKey, undefined)
                }
              }

              const previousRules = cloneRecord(T.rules.get(keyOf(session.id, 'spec')))
              const previousBeauty = previousRules?.beauty ?? {}
              const newRuleText = Object.fromEntries(RULE_TEXT_FIELDS.map(field=>[field,joinImported(rules[field])]))
              const nextBeauty = {
                regexRules: replaceMode
                  ? beauty.regexRules
                  : [...(previousBeauty.regexRules ?? []), ...beauty.regexRules],
                css: replaceMode ? joinImported(beauty.css) : mergeText(previousBeauty.css, joinImported(beauty.css)),
                js: replaceMode ? joinImported(beauty.js) : mergeText(previousBeauty.js, joinImported(beauty.js)),
                sources: replaceMode
                  ? beauty.sources
                  : [...(previousBeauty.sources ?? []), ...beauty.sources],
              }
              const previousRuleSources = previousRules?.sources ?? {}
              const nextRules = {
                schemaVersion: 1,
                ...(replaceMode ? {} : previousRules ?? {}),
                ...Object.fromEntries(RULE_TEXT_FIELDS.filter(field=>replaceMode||newRuleText[field]).map(field=>[field,replaceMode?newRuleText[field]:mergeText(previousRules?.[field],newRuleText[field])])),
                beauty: nextBeauty,
                sources: {
                  ...Object.fromEntries(RULE_TEXT_FIELDS.map(field=>[field,replaceMode?ruleSources[field]:[...(previousRuleSources[field]??[]),...ruleSources[field]]])),
                  archiveOnly: replaceMode ? archiveSources : [...(previousRuleSources.archiveOnly ?? []), ...archiveSources],
                },
                importId: record.importId,
                verified: replaceMode || !previousRules || previousRules.verified === true,
                updatedAt: Date.now(),
                updatedAtSeq: atSeq,
              }
              addWrite('rules', keyOf(session.id, 'spec'), nextRules)

              const previousStatus = cloneRecord(T.status.get(keyOf(session.id, 'spec')))
              const importedStatus = joinImported(status)
              if (importedStatus) {
                addWrite('status', keyOf(session.id, 'spec'), {
                  ...(replaceMode ? {} : previousStatus ?? {}),
                  text: replaceMode ? importedStatus : mergeText(previousStatus?.text, importedStatus),
                  templateHtml: replaceMode ? importedStatus : mergeText(previousStatus?.templateHtml, importedStatus),
                  sources: replaceMode ? statusSources : [...(previousStatus?.sources ?? []), ...statusSources],
                  importId: record.importId,
                  verified: replaceMode || !previousStatus || previousStatus.verified === true,
                  updatedAt: Date.now(),
                  updatedAtSeq: atSeq,
                })
              } else if (replaceMode && previousStatus) {
                addWrite('status', keyOf(session.id, 'spec'), undefined)
              }
              const previousPanel = cloneRecord(T.status.get(keyOf(session.id, 'panel')))
              if (replaceMode && previousPanel) addWrite('status', keyOf(session.id, 'panel'), undefined)

              const previousOpening = cloneRecord(T.opening.get(keyOf(session.id, 'scene')))
              const importedOpening = joinImported(opening)
              if (importedOpening) {
                addWrite('opening', keyOf(session.id, 'scene'), {
                  ...(replaceMode ? {} : previousOpening ?? {}),
                  text: replaceMode ? importedOpening : mergeText(previousOpening?.text, importedOpening),
                  sources: replaceMode ? openingSources : [...(previousOpening?.sources ?? []), ...openingSources],
                  importId: record.importId,
                  verified: replaceMode || !previousOpening || previousOpening.verified === true,
                  updatedAt: Date.now(),
                  updatedAtSeq: atSeq,
                })
              } else if (replaceMode && previousOpening) {
                addWrite('opening', keyOf(session.id, 'scene'), undefined)
              }

              const activeKey = importActiveKey(session.id)
              const activePointerPrev = cloneRecord(T.branch.get(activeKey))
              const transactionId = randomUUID()
              const transaction = {
                transactionId,
                preparedAt: Date.now(),
                activePointerPrevExists: activePointerPrev !== undefined,
                activePointerPrev,
                writes: writes.map((write) => ({
                  tableName: write.tableName,
                  key: write.key,
                  prevExists: write.prev !== undefined,
                  prev: cloneRecord(write.prev),
                  nextSha256: recordSha256(write.next),
                })),
              }
              const committingRecord = { ...cloneRecord(record), status: 'committing', transaction }
              try {
                await T.branch.put(key, committingRecord)
              } catch (error) {
                return { ok: false, error: `无法建立导入事务日志：${String(error?.message ?? error)}` }
              }

              try {
                for (const write of writes) {
                  assertCardWorkflow(session,record)
                  const expectedPrev = recordSha256(write.prev)
                  const actualPrev = recordSha256(write.table.get(write.key))
                  if (actualPrev !== expectedPrev) {
                    throw new Error(`并发修改冲突：${write.tableName}:${write.key} 已不再等于事务快照，拒绝覆盖`)
                  }
                  if (write.next === undefined) await write.table.delete(write.key)
                  else await write.table.put(write.key, cloneRecord(write.next))
                }
                const failedWrite = writes.find((write) => !verifyWrite(write))
                if (failedWrite) throw new Error(`写后校验失败：${failedWrite.tableName}:${failedWrite.key}`)
                assertCardWorkflow(session,record)

                const activatedAt = Date.now()
                const activationSummary = {
                  cards: [...cards.keys()],
                  worldbook: [...worldbook.keys()],
                  rules: Object.fromEntries(Object.entries(rules).map(([name, value]) => [name, value.length])),
                  status: status.length > 0,
                  opening: opening.length > 0,
                  archiveOnly: archiveSources.length,
                  beauty: { cssChars: nextBeauty.css.length, jsChars: nextBeauty.js.length, regexRules: nextBeauty.regexRules.length },
                }
                const activePointer = {
                  importId: record.importId,
                  transactionId,
                  normalizedSha256: record.normalizedSha256,
                  coverageSha256: recordSha256(coverage),
                  activatedAt,
                }
                if (recordSha256(T.branch.get(activeKey)) !== recordSha256(activePointerPrev)) {
                  throw new Error('active pointer 在事务期间被其他写入修改，拒绝覆盖')
                }
                await T.branch.put(activeKey, activePointer)
                if (recordSha256(T.branch.get(activeKey)) !== recordSha256(activePointer)) {
                  throw new Error('active pointer 写后校验失败')
                }
                const activeRecord = {
                  ...cloneRecord(record),
                  status: 'active',
                  assignments: record.assignments.map((assignment) => ({
                    ...cloneRecord(assignment),
                    materializedSha256: sha256(spanText(record, assignment.sourceSpans)),
                  })),
                  coverage,
                  archiveSources,
                  activatedAt,
                  activation: {
                    transactionId,
                    writeDigests: writes.map((write) => ({ tableName: write.tableName, key: write.key, sha256: recordSha256(write.next) })),
                    summary: activationSummary,
                  },
                }
                await T.branch.put(key, activeRecord)
                if (recordSha256(T.branch.get(key)) !== recordSha256(activeRecord)) {
                  throw new Error('active import record 写后校验失败')
                }
                let resource=null
                assertCardWorkflow(session,activeRecord)
                try {resource=await archiveImported(session,activeRecord)}catch{}
                assertCardWorkflow(session,activeRecord)
                await completeCardWorkflow(session,activeRecord,{importId:activeRecord.importId,resourceId:resource?.resourceId??resource?.id??null})
                return { ok: true, ...importSummary(activeRecord), ...activationSummary,resourceId:resource?.resourceId??resource?.id??null }
              } catch (error) {
                try {
                  try { await T.branch.put(key, committingRecord) } catch {}
                  await restoreImportTransaction(session.id, key, committingRecord)
                  return {
                    ok: false,
                    rolledBack: true,
                    error: `激活失败，已完整恢复激活前状态：${String(error?.message ?? error)}`,
                  }
                } catch (rollbackError) {
                  return {
                    ok: false,
                    recoveryRequired: true,
                    error: `激活失败且自动回滚不完整：${String(rollbackError?.message ?? rollbackError)}`,
                  }
                }
              }
            } catch (error) {
              return { ok: false, error: String(error?.message ?? error) }
            }
          })
        }
      )
    ),
    'roleplay: tool rp_card_import_finalize'
  )

  // rp_commit_card 的结构化写入（id 一律 sanitize）
  async function commitParsedCard(session, data, atSeq) {
    const written = []
    for (const c of data.cards ?? []) {
      const id = c.kind === 'user' ? 'user' : stableImportId(c.card_id ?? c.name)
      const prev = T.cards.get(keyOf(session.id, id)) ?? {}
      await T.cards.put(keyOf(session.id, id), {
        id,
        name: String(c.name ?? id).slice(0, 60),
        kind: c.kind === 'user' ? 'user' : 'npc',
        content: String(c.content ?? ''),
        locked: c.locked === undefined ? prev.locked === true : c.locked === true,
        version: (Number(prev.version) || 0) + 1,
        updatedAtSeq: atSeq,
        verified: false,
        source: 'authored-by-agent',
      })
      written.push({ target: 'cards', id })
    }
    for (const e of data.worldbook ?? []) {
      const id = stableImportId(e.id ?? e.name)
      const prev = T.worldbook.get(keyOf(session.id, id)) ?? {}
      await T.worldbook.put(keyOf(session.id, id), {
        id,
        kind: e.kind ?? 'term',
        name: String(e.name ?? id).slice(0, 60),
        aliases: (e.aliases ?? prev.aliases ?? []).map(String),
        keywords: (e.keywords ?? prev.keywords ?? []).map(String),
        triggers: (e.triggers ?? prev.triggers ?? []).map(String),
        priority: e.priority === undefined ? Number(prev.priority) || 0 : Number(e.priority) || 0,
        tokenBudget: e.tokenBudget === undefined ? Number(prev.tokenBudget) || 500 : Number(e.tokenBudget) || 500,
        alwaysOn: e.alwaysOn === undefined ? prev.alwaysOn === true : e.alwaysOn === true,
        content: String(e.content ?? ''),
        locked: e.locked === undefined ? prev.locked === true : e.locked === true,
        version: (Number(prev.version) || 0) + 1,
        updatedAtSeq: atSeq,
        verified: false,
        source: 'authored-by-agent',
      })
      written.push({ target: 'worldbook', id })
    }
    if (data.statusSpec) {
      await svc.setStatusSpec(session.id, String(data.statusSpec), atSeq)
      written.push({ target: 'status' })
    }
    if (data.rules && typeof data.rules === 'object') {
      const prev = T.rules.get(keyOf(session.id, 'spec')) ?? {}
      const acceptedRules = {}
      for (const key of RULE_TEXT_FIELDS) {
        if (typeof data.rules[key] === 'string') acceptedRules[key] = data.rules[key]
      }
      await svc.setRules(session.id, { ...prev, ...acceptedRules, verified: false, source: 'authored-by-agent' }, atSeq)
      written.push({ target: 'rules' })
    }
    if (data.beauty && typeof data.beauty === 'object') {
      // 排版美化：正文渲染层的作者特效（正则规则 + 作用域 CSS + 渲染后 JS）
      const prev = T.rules.get(keyOf(session.id, 'spec')) ?? {}
      const rawRegexRules = Array.isArray(data.beauty.regexRules) ? data.beauty.regexRules : []
      if (rawRegexRules.length > 200) throw new Error('beauty.regexRules 超过 200 条；拒绝静默截断')
      const regexRules = rawRegexRules
        .filter((r) => r && typeof r === 'object' && typeof r.match === 'string' && typeof r.replace === 'string')
        .map((r) => ({ match: String(r.match), replace: String(r.replace) }))
      const css = typeof data.beauty.css === 'string' ? data.beauty.css : ''
      const js = typeof data.beauty.js === 'string' ? data.beauty.js : ''
      if (css.length > 200000 || js.length > 100000) throw new Error('beauty CSS/JS 过大；拒绝静默截断，请拆分后再提交')
      const beauty = {
        regexRules,
        css,
        js,
      }
      await svc.setRules(session.id, { ...prev, beauty, verified: false, source: 'authored-by-agent' }, atSeq)
      written.push({ target: 'beauty' })
    }
    if (data.opening) {
      await svc.setOpening(session.id, String(data.opening), atSeq)
      written.push({ target: 'opening' })
    }
    return written
  }

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_commit_card',
        '写卡工作流最后一步：主代理完成合成与矫审后，把最终结构化的角色卡/世界书/状态栏设定/叙事规则/初始剧情一次性写入当前分支（旧栏目为新版本，绝不覆盖历史）。',
        {
          type: 'object',
          properties: {
            cards: {
              type: 'array',
              items: {
                type: 'object',
                properties: { card_id: { type: 'string' }, name: { type: 'string' }, kind: { type: 'string' }, content: { type: 'string' }, locked: { type: 'boolean' } },
                required: ['name', 'content'],
                additionalProperties: false,
              },
            },
            worldbook: {
              type: 'array',
              items: {
                type: 'object',
                properties: { id: { type: 'string' }, kind: { type: 'string' }, name: { type: 'string' }, aliases: { type: 'array', items: { type: 'string' } }, keywords: { type: 'array', items: { type: 'string' } }, triggers: { type: 'array', items: { type: 'string' } }, priority: { type: 'number' }, token_budget: { type: 'number' }, always_on: { type: 'boolean' }, content: { type: 'string' }, locked: { type: 'boolean' } },
                required: ['name', 'content'],
                additionalProperties: false,
              },
            },
            statusSpec: { type: 'string' },
            rules: {
              type: 'object',
              properties: {
                core: { type: 'string', description:'常驻核心设定：世界基础、核心威胁、长期矛盾，完整保留。' },
                plot: { type: 'string', description:'剧情指引：路线、条件与可能结局，不是已发生事实。' },
                narrative: { type: 'string' },
                reply: { type: 'string' },
                style: { type: 'string', description:'文风特化：完整写作要求和示例，不精简为关键词。' },
              },
              additionalProperties: false,
            },
            opening: { type: 'string' },
            beauty: {
              type: 'object',
              additionalProperties: true,
              description: '「排版美化」栏目：正文渲染层的作者特效（正则规则 + CSS + JS；regexRules 与状态栏同格式）。',
              properties: {
                regexRules: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { match: { type: 'string' }, replace: { type: 'string' } },
                    required: ['match', 'replace'],
                    additionalProperties: true,
                  },
                },
                css: { type: 'string', description: '作用域样式（选择器自动加 .rp-reader 前缀）' },
                js: { type: 'string', description: '渲染后执行的脚本（沙箱参数：root=阅读容器元素, fill=填入输入框函数）' },
              },
            },
          },
          required: [],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          const data = {
            cards: args.cards ?? [],
            worldbook: (args.worldbook ?? []).map((e) => ({ ...e, tokenBudget: e.token_budget, alwaysOn: e.always_on })),
            statusSpec: args.statusSpec ?? null,
            rules: args.rules ?? null,
            opening: args.opening ?? null,
            beauty: args.beauty ?? null,
          }
          const written = await commitParsedCard(session, data, lastSeq(session))
          return { ok: true, written }
        }
      )
    ),
    'roleplay: tool rp_commit_card'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_roll',
        '投骰子（如 "2d6+1"、"1d20"、"3d6"）。结果记录进当前分支的投掷日志，数值只能由此产生或修改。',
        {
          type: 'object',
          properties: {
            spec: { type: 'string', description: '骰子表达式，如 2d6+1' },
            reason: { type: 'string', description: '为什么投（用于日志）' },
          },
          required: ['spec'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          const m = String(args.spec).trim().match(/^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i)
          if (!m) return { ok: false, error: '无法解析骰子表达式，格式如 2d6+1' }
          const count = Math.min(Math.max(parseInt(m[1] || '1', 10), 1), 100)
          const sides = Math.min(Math.max(parseInt(m[2], 10), 1), 1000)
          const rolls = []
          for (let i = 0; i < count; i++) rolls.push(randomInt(1, sides + 1))
          let total = rolls.reduce((a, b) => a + b, 0)
          if (m[3] === '+') total += parseInt(m[4] || '0', 10)
          if (m[3] === '-') total -= parseInt(m[4] || '0', 10)
          const record = { spec: String(args.spec), rolls, total, reason: args.reason ?? '', atSeq: lastSeq(session), time: Date.now() }
          const rollKey = keyOf(session.id, 'log')
          const log = rollLogEntries(T.rolls.get(rollKey))
          await T.rolls.put(rollKey, rollLogRecord([...log, record]))
          return { ok: true, spec: record.spec, rolls, total, reason: record.reason }
        }
      )
    ),
    'roleplay: tool rp_roll'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_state',
        '查看当前分支的状态面板：场景快照、投掷日志尾部、记忆账本统计、待确认冲突。',
        { type: 'object', properties: {}, additionalProperties: false },
        async (_args, exec) => {
          const session = await sessionOf(exec)
          const mem = T.memory.get(keyOf(session.id, 'head')) ?? {}
          return {
            scene: T.scene.get(keyOf(session.id, 'current')) ?? null,
            rolls: rollLogEntries(T.rolls.get(keyOf(session.id, 'log'))).slice(-10),
            memory: {
              deltaCount: (mem.deltas ?? []).length,
              pendingConfirmations: (mem.pendingConfirmations ?? []).slice(-5),
              lockedFactCount: (mem.lockedFacts ?? []).length,
              version: mem.version ?? 1,
            },
            meta: T.branch.get(keyOf(session.id, 'meta')) ?? null,
          }
        }
      )
    ),
    'roleplay: tool rp_state'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_scene_set',
        '直接修正当前分支的场景快照（用户/模型明确确认的修正；只改传入字段）。',
        {
          type: 'object',
          properties: {
            place: { type: 'string' },
            time: { type: 'string' },
            timeline: { type: 'string' },
            present: { type: 'array', items: { type: 'string' } },
            positions: { type: 'object' },
            outfits: { type: 'object' },
            items: { type: 'object' },
            moods: { type: 'object' },
            injuries: { type: 'object' },
            pendingActions: { type: 'array', items: { type: 'string' } },
            environment: { type: 'string' },
          },
          required: [],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          const prev = T.scene.get(keyOf(session.id, 'current')) ?? {}
          const next = { ...prev }
          for (const f of ['place', 'time', 'timeline', 'environment']) if (args[f] !== undefined) next[f] = String(args[f])
          for (const f of ['present', 'pendingActions']) if (Array.isArray(args[f])) next[f] = args[f].map(String)
          for (const f of ['positions', 'outfits', 'items', 'moods', 'injuries']) if (args[f] && typeof args[f] === 'object') next[f] = { ...(prev[f] ?? {}), ...args[f] }
          next.updatedAtSeq = lastSeq(session)
          await T.scene.put(keyOf(session.id, 'current'), next)
          return { ok: true, scene: next }
        }
      )
    ),
    'roleplay: tool rp_scene_set'
  )

  ctx.effect(()=>ctx.tools.register(simpleTool(
    'rp_card_draft_check',
    '写卡管理入口与只读文件检查。开始创作/询问偏好时不传路径；定稿后传 source_path 检查实际 Markdown 文件、JSON、美化规则。不会激活角色卡或生成剧情。',
    {type:'object',properties:{source_path:{type:'string'},review:{type:'array',maxItems:12,items:{type:'object',properties:{id:{type:'string'},section:{type:'string',description:'实际文件中对应章节的完整标题，不含 #'},basis:{type:'string',enum:['confirmed','default']}},required:['id','section','basis'],additionalProperties:false}}},additionalProperties:false},
    async(args,exec)=>{
      const session=await sessionOf(exec)
      const checklist=Object.entries({overview:'角色卡整体概述',world:'世界观：背景、核心矛盾/剧情驱动力、特殊种族、与现实的核心区别',factions:'势力设定',locations:'重要地点场景描述',characters:'多角色：基本信息、小传、外貌、性格、萌点、特质、语言风格、喜好、行为逻辑',plot:'剧情发展指引',style:'文风特化示例',opening:'开场剧情',status:'状态栏',rules:'叙事与回复规则',beauty:'HTML/CSS美化',regex:'正则表达式'}).map(([id,label])=>({id,label}))
      if(!args.source_path)return {ok:true,mode:'authoring',checklist,next:'先通过原生 ask_user_question / questions 分批交流偏好，每批3–4个有具体选项的问题，保留自由描述，根据上一批回答调整下一批。用户说你来决定即可跳过剩余问题，但仍需检查全部12项。大纲明确后可并行细化独立模块。不要向玩家解释内部管理标记。'}
      const source=readCardSource(session.header.cwd,args.source_path)
      if(!['.md','.markdown'].includes(source.extension)||source.bytes.length>1_000_000)throw new Error('请提供当前工作区内 1MB 以内的 Markdown 草稿')
      const text=source.bytes.toString('utf8'),errors=[],rules=[]
      const headings=[...text.matchAll(/^#{1,3}\s+(.+)$/gm)].map(m=>m[1].trim())
      const review=Array.isArray(args.review)?args.review:[]
      for(const item of checklist){
        const records=review.filter(r=>r.id===item.id)
        if(records.length!==1||!['confirmed','default'].includes(records[0]?.basis)||!headings.includes(records[0]?.section))errors.push(`请审阅 ${item.id}（${item.label}），提交对应实际章节与 confirmed/default 依据`)
      }
      if(review.some(r=>!checklist.some(c=>c.id===r.id)))errors.push('审阅记录包含未知清单项')
      let jsonBlocks=0
      for(const match of text.matchAll(/^```json\s*\r?\n([\s\S]*?)^```\s*$/gm)){
        jsonBlocks++
        try {
          const value=JSON.parse(match[1]),items=Array.isArray(value)?value:value.regexRules??(value.match?[value]:[])
          for(const r of items){
            if(typeof r.match!=='string'||typeof r.replace!=='string'){errors.push('正则条目需要 match/replace 字符串');continue}
            rules.push(r)
          }
        }catch{errors.push(`第 ${jsonBlocks} 个 JSON 代码块无法解析`)}
      }
      const regex=await boundedRegexMatch(rules.map(r=>({pattern:r.match,flags:String(r.flags??'m').replace(/[gy]/g,'')})),text.slice(-32768))
      if(!jsonBlocks||rules.length<2)errors.push('全量草稿应提供至少两条正则规则及对应示例')
      if(!regex.ok)errors.push(`正则检查未完成：${regex.reason}`)
      else regex.matches.forEach((matched,i)=>{if(!matched)errors.push(`第 ${i+1} 条正则无有效匹配示例或表达式无效`)})
      return {ok:errors.length===0,schemaVersion:1,sourcePath:source.sourcePath,bytes:source.sourceBytes,sha256:sha256(text),
        headings:headings.slice(0,100),jsonBlocks,regexRules:rules.length,errors,checklist,
        limitations:'程序仅检查文件与可解析/匹配结构；人物深度、栏目语义完整性、CSS视觉效果及剧情一致性仍需创作者核对。没有激活卡片。'}
    }
  )),'roleplay: draft authoring check')

  ctx.effect(()=>ctx.tools.register(simpleTool(
    'rp_diagnose',
    '按需查看当前酒馆会话的只读诊断概览：有效模型、窗口、任务与近期调用。用于玩法说明/故障问答，不用于普通剧情，不重试任务或修改状态。',
    {type:'object',properties:{},additionalProperties:false},
    async(_args,exec)=>{
      const session=await sessionOf(exec)
      const policy=await modelPolicy.read(session,exec.agent)
      const route=r=>r?{provider:r.provider??null,model:r.model??null,reasoningEffort:r.reasoningEffort??null}:null
      const jobs=tavernTasks.list(session)
      const status=T.status.get(keyOf(session.id,'panel'))
      const memory=T.memory.get(keyOf(session.id,'head'))
      // Whitelist projections: never return raw errors, request payloads,
      // credentials, authored HTML, story text or full job sources.
      const errorCode=e=>{
        const value=typeof e==='string'?e:e?.code??e?.message??''
        return String(value).match(/\b(?:TASK_TIMEOUT|TRANSPORT|AUTHENTICATION_ERROR|AUTH_ERROR|INVALID_API_KEY|INSUFFICIENT_QUOTA|RATE_LIMIT|INVALID_REQUEST|OVERLOADED|ABORTED)\b/)?.[0]??(e?'REASON_NOT_PROVIDED':null)
      }
      const turnStart=eventsOf(session).findLast(e=>e.type==='turn/start')?.time??Date.now()
      const historyCalls=[...new Map(telemetry.calls().filter(r=>r.ownerSessionId===session.id&&r.startedAt<turnStart).map(r=>[r.id,r])).values()]
      const calls=historyCalls.sort((a,b)=>b.startedAt-a.startedAt).slice(0,12)
      const stamp=t=>Number.isFinite(t)?new Date(t).toISOString():null
      const local=t=>Number.isFinite(t)?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(t):null
      const activity=readRoleplayActivity(session,T.branch.get(preparationRecordKey(session.id)),tavernTasks.activity(session))
      return {
        schemaVersion:1,sessionId:session.id,branchId:session.id,observedAt:Date.now(),timeZone:'Asia/Shanghai (UTC+08:00)',interaction:'management-diagnosis; current diagnostic calls excluded from historical statistics',
        capabilities:{legacyStatusTool:false,passiveWorldbook:true,hardWindowNotesHistory:true,characterCluster:true},
        characterCluster:{enabled:characterCluster.read(session).enabled,characters:characterRoster(session).map(({id,name})=>({id,name})),settings:characterCluster.read(session)},
        models:{main:route(policy.main),allMain:policy.effective.allMain,inheritedFrom:policy.inheritedFrom,
          routes:Object.fromEntries(['status','decision','memory'].map(k=>[k,route(policy.effective.allMain?policy.main:policy.effective.routes[k]??policy.main)])),
          globalRevision:policy.global.revision,sessionRevision:policy.session?.revision??null},
        window:Object.fromEntries(['contextWindowTokens','continuityTailTokens','autoNotesEveryTurns'].map(k=>[k,memorySettingsPolicy(session.id).effective[k]])),
        activity:{turn:activity.turn,running:activity.running,stage:activity.stage,elapsedMs:activity.elapsedMs,
          storySeq:activity.storySeq,backgroundJobs:activity.backgroundJobs?.map(j=>({kind:j.kind,status:j.status,createdAt:j.createdAt})),
          pendingPlayer:!!activity.pendingPlayer},
        saved:{statusPresent:!!status,statusSource:status?.source?{turnId:status.source.turnId,sourceSeqs:status.source.sourceSeqs}:null,
          memoryVersion:memory?.version??null,deltaCount:memory?.deltas?.length??0,pendingConfirmationCount:memory?.pendingConfirmations?.length??0},
        jobs:jobs.sort((a,b)=>b.createdAt-a.createdAt).slice(0,12).map(j=>{
          const attempts=historyCalls.filter(r=>r.source?.jobId===j.id||r.source?.jobIds?.includes(j.id))
          const started=attempts.length?Math.min(...attempts.map(r=>r.startedAt)):null
          const completed=attempts.filter(r=>Number.isFinite(r.durationMs)).map(r=>r.startedAt+r.durationMs)
          return {id:j.id,kind:j.kind,status:j.status,background:j.background===true,
            createdAt:stamp(j.createdAt),completedAt:stamp(j.completedAt),failedAt:stamp(j.failedAt??(j.status==='failed'?j.updatedAt:null)),execution:j.execution??j.selection?.execution??null,
            requested:route(j.actualRoute??j.selection?.actualRoute),errorCode:taskValidationFailure(j)?.code??errorCode(j.error),
            failure:taskValidationFailure(j),validationFailures:j.validationFailures??0,
            recordedCalls:attempts.length,failedCalls:attempts.filter(r=>r.status==='failed').length,
            callSpanSeconds:started!==null&&completed.length?Math.round((Math.max(...completed)-started)/10)/100:null,
            callStartedAtLocal:local(started),callCompletedAtLocal:completed.length?local(Math.max(...completed)):null,
            actualModels:[...new Set(attempts.map(r=>`${r.provider}/${r.model}`))]}
        }),
        calls:calls.map(r=>({id:r.id,kind:r.kind,provider:r.provider,model:r.model,status:r.status,
          startedAt:stamp(r.startedAt),startedAtLocal:local(r.startedAt),durationSeconds:Number.isFinite(r.durationMs)?r.durationMs/1000:null,firstTokenSeconds:Number.isFinite(r.firstTokenMs)?r.firstTokenMs/1000:null,
          usage:r.usage?{inputTokens:r.usage.inputTokens??null,outputTokens:r.usage.outputTokens??null,cacheReadTokens:r.usage.cacheReadTokens??null}:null,
          jobId:r.source?.jobId??null,errorCode:errorCode(r.error)})),
        coverage:'仅当前会话已记录调用；缺失历史与无明确错误原因不能推断。未主动重试或发起模型请求。',
      }
    }
  )),'roleplay: read-only diagnosis')

  // rp_status_set is retired: automatic source-fenced maintenance owns panels.
  // Existing input records remain readable for restored sessions; no model tool
  // may create another input or schedule duplicate panel work.

  // ── 命令：/scene /worldbook /roll /regenerate /export-novel /branch /memory ──

  ctx.effect(() =>
    ctx.commands.register({
      name: 'scene',
      description: '查看/修正当前角色扮演会话的场景状态',
      input: { hint: '（可选）直接描述场景变化' },
      handler: async (invocation) => {
        const session = invocation.agent?.session
        if (!session || !isRoleplaySession(session)) return { kind: 'error', text: '当前会话不是角色扮演会话' }
        const raw = invocation.rawInput?.trim()
        if (raw) {
          const prev = T.scene.get(keyOf(session.id, 'current')) ?? {}
          await T.scene.put(keyOf(session.id, 'current'), { ...prev, place: raw, updatedAtSeq: lastSeq(session) })
          return { kind: 'success', text: `场景已更新：${raw}` }
        }
        const scene = T.scene.get(keyOf(session.id, 'current'))
        return { kind: 'success', text: scene ? JSON.stringify(scene, null, 2) : '（尚无场景快照）' }
      },
    }),
    'roleplay: command scene'
  )

  ctx.effect(() =>
    ctx.commands.register({
      name: 'worldbook',
      description: '查看当前分支的世界书条目',
      input: { hint: '（可选）条目 id 或关键词' },
      handler: async (invocation) => {
        const session = invocation.agent?.session
        if (!session || !isRoleplaySession(session)) return { kind: 'error', text: '当前会话不是角色扮演会话' }
        const prefix = `${session.id}__`
        const q = (invocation.rawInput ?? '').trim().toLowerCase()
        const out = []
        for (const [k, v] of T.worldbook.entries()) {
          if (!k.startsWith(prefix) || !v) continue
          if (q && !`${v.id} ${v.name} ${(v.keywords ?? []).join(' ')}`.toLowerCase().includes(q)) continue
          out.push(renderWorldbookEntry(v))
        }
        return { kind: 'success', text: out.length ? out.join('\n\n---\n\n') : '（没有匹配的世界书条目）' }
      },
    }),
    'roleplay: command worldbook'
  )

  ctx.effect(() =>
    ctx.commands.register({
      name: 'roll',
      description: '投骰子（如 2d6+1）',
      input: { hint: '骰子表达式，如 2d6+1' },
      handler: async (invocation) => {
        const session = invocation.agent?.session
        if (!session || !isRoleplaySession(session)) return { kind: 'error', text: '当前会话不是角色扮演会话' }
        const m = String(invocation.rawInput ?? '').trim().match(/^(\d*)d(\d+)(?:\s*([+-])\s*(\d+))?$/i)
        if (!m) return { kind: 'error', text: '格式如 /roll 2d6+1' }
        const count = Math.min(Math.max(parseInt(m[1] || '1', 10), 1), 100)
        const sides = Math.min(Math.max(parseInt(m[2], 10), 1), 1000)
        const rolls = []
        for (let i = 0; i < count; i++) rolls.push(randomInt(1, sides + 1))
        let total = rolls.reduce((a, b) => a + b, 0)
        if (m[3] === '+') total += parseInt(m[4] || '0', 10)
        if (m[3] === '-') total -= parseInt(m[4] || '0', 10)
        const rollKey = keyOf(session.id, 'log')
        const log = rollLogEntries(T.rolls.get(rollKey))
        const record = { spec: String(invocation.rawInput).trim(), rolls, total, atSeq: lastSeq(session), time: Date.now() }
        await T.rolls.put(rollKey, rollLogRecord([...log, record]))
        return { kind: 'success', text: `🎲 ${invocation.rawInput.trim()} → ${rolls.join(' + ')}${m[3] ? ` ${m[3]} ${m[4]}` : ''} = **${total}**` }
      },
    }),
    'roleplay: command roll'
  )

  ctx.effect(() =>
    ctx.commands.register({
      name: 'regenerate',
      description: '兼容提示：重新生成已迁移到消息操作行的原生 Session 分支按钮。',
      input: { hint: '请使用目标回复旁的重新生成/编辑按钮' },
      handler: async (invocation) => {
        const session = invocation.agent?.session
        if (!session || !isRoleplaySession(session)) return { kind: 'error', text: '当前会话不是角色扮演会话' }
        return {
          kind: 'error',
          text: '为保证分支上下文和记忆隔离，/regenerate 已停用。请在目标回复下点击“重新生成”；需要改写玩家消息时点击旁边的铅笔按钮。',
        }
      },
    }),
    'roleplay: command regenerate'
  )

  ctx.effect(()=>ctx.commands.register({
    name:'export-novel',description:'将当前分支完整剧情整理为 Markdown 小说，包含已归档历史。',
    input:{hint:'直接执行即可'},handler:async invocation=>{
      const session=invocation.agent?.session
      if(!session||!isRoleplaySession(session))return {kind:'error',text:'当前会话不是角色扮演会话'}
      try {
        const job=await startExportJob(session,'novel-export',invocation.agent)
        return {kind:'success',text:`已开始完整小说整理。可在酒馆管理的导出页查看进度和下载，任务编号 ${job.id}。`}
      }catch(error){return {kind:'error',text:String(error.message)}}
    },
  }),'roleplay: command export-novel')

  ctx.effect(() =>
    ctx.commands.register({
      name: 'branch',
      description: '查看当前分支血缘；创建分支请用会话消息末尾的分支按钮（fork）',
      handler: async (invocation) => {
        const session = invocation.agent?.session
        if (!session || !isRoleplaySession(session)) return { kind: 'error', text: '当前会话不是角色扮演会话' }
        const chain = svc.branchLineage(session)
        const lines = chain.map((c, i) => {
          const label = i === 0 ? '★ 当前分支' : `祖先 ${i}`
          return `${label} session=${c.sessionId}${c.seedLength !== null ? ` seedLength=${c.seedLength}` : ''}`
        })
        return { kind: 'success', text: '分支血缘（当前 → 祖先）：\n' + lines.join('\n') }
      },
    }),
    'roleplay: command branch'
  )

  // ── 侧边栏 REST：读/写角色扮演状态（记忆/世界书/角色卡/设置）──────────────
  // 供 dsh-roleplay-ui 的侧边栏面板使用；路由随 standing 挂载注册一次，
  // 按 sessionId 解析会话并校验其预设；与 /api/session.export 同级的
  // 认证模型（浏览器 cookie）。

  const jsonResponse = (status, value) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })

  const collectBranchRecords = (session) => {
    const prefix = `${session.id}__`
    const cards = []
    for (const [k, v] of T.cards.entries()) if (k.startsWith(prefix) && v) cards.push(v)
    const worldbook = []
    for (const [k, v] of T.worldbook.entries()) if (k.startsWith(prefix) && v) worldbook.push(v)
    return { cards, worldbook }
  }

  const recordVersionsFor = session => ({
    cards:Object.fromEntries([...T.cards.entries()].filter(([k])=>k.startsWith(`${session.id}__`)).map(([k,v])=>[k.slice(session.id.length+2),recordSha256(v)])),
    worldbook:Object.fromEntries([...T.worldbook.entries()].filter(([k])=>k.startsWith(`${session.id}__`)).map(([k,v])=>[k.slice(session.id.length+2),recordSha256(v)])),
    memory:recordSha256(T.memory.get(keyOf(session.id,'head'))),settings:recordSha256(T.branch.get(keyOf(session.id,'settings'))),
    status:recordSha256(T.status.get(keyOf(session.id,'spec'))),rules:recordSha256(T.rules.get(keyOf(session.id,'spec'))),opening:recordSha256(T.opening.get(keyOf(session.id,'scene'))),
  })
  const readRoleplayState = async (session) => {
    await awaitImportBarrier(session.id)
    await ensureBranch(session)
    await repairLegacyUserReplacementIdentities(session)
    let forkLookup = buildForkLookupIndex()
    await reconcileCanonicalPlayerVariants(session, forkLookup)
    if (!statusRecoveredSessions.has(session.id)) {
      statusRecoveredSessions.add(session.id)
      recoverStatusObligations(session, 'session-resume')
    }
    const branchGroupsByMessageId = await nativeBranchGroupsFor(session, forkLookup)
    // nativeBranchGroupsFor deliberately rebuilds its own lookup after repair;
    // use a fresh index for the related player/deletion projections too.
    forkLookup = buildForkLookupIndex()
    const userActionsBySeq = await nativePlayerGroupsFor(session, branchGroupsByMessageId)
    const failedTurnRecoveryByTurn = {}, failedTurnBranchGroupByTurn = {}, assistantActionAnchorsByTurn = {}
    const internalMessages = internalTaskSeqs(session)
    const internalAssistantMessageIds = eventsOf(session).filter(event => event.type === 'assistant/message' && internalMessages.has(event.seq))
      .map(assistantMessageId).filter(Boolean)
    const endedTurns = new Set(eventsOf(session).filter(event => event?.type === 'turn/end').map(event => Number(event.data?.turn)))
    for (const turn of endedTurns) {
      const canonical = canonicalAssistantForTurn(session, turn)
      const messageId = canonical && assistantMessageId(canonical)
      if (messageId) assistantActionAnchorsByTurn[String(turn)] = { seq:Number(canonical.seq), messageId }
    }
    const maintenanceTurns = new Set(), playerTurns = new Set()
    let activeTurn = null
    for (const event of eventsOf(session)) {
      if (event?.type === 'turn/start') activeTurn = Number(event.data?.turn)
      if (event?.type === 'user/message' && event.data?.source?.plugin === 'roleplay-tasks' && Number.isSafeInteger(activeTurn)) maintenanceTurns.add(activeTurn)
      if (event?.type === 'user/message' && event.data?.source?.kind === 'user' && Number.isSafeInteger(activeTurn)) {
        playerTurns.add(activeTurn)
        try {
          if (endedTurns.has(activeTurn) && !canonicalAssistantForTurn(session, activeTurn)) {
            const context = userForkContext(session, Number(event.seq))
            failedTurnRecoveryByTurn[String(activeTurn)] = Number(context.event.seq)
            const recovery = locatePlayerRecoveryTarget(session, Number(context.event.seq))
            let membership = failedForkMembership(session, context.event, forkLookup)
            // A historical child can belong to a recovery group whose anchor
            // points at its failed root.  Repair that root, rather than
            // treating the child as a new source with a different anchor.
            const repairAnchor = membership?.group?.anchor?.recoveryOnly === true
              ? membership.group.anchor
              : recovery
            const hasOrigin=membership?.group?.members.some(member=>isRecoverySourceMember(member,repairAnchor))
            if (repairAnchor && !hasOrigin && await backfillRecoverySourceMember(repairAnchor)) {
              forkLookup = buildForkLookupIndex()
              membership = failedForkMembership(session, context.event, forkLookup)
            }
            const group = membership?.group
            if (group) {
              const current = membership.member
              // Legacy failure cleanup marked empty failed members deleted.
              // Restore navigation for this proven current failed request only;
              // explicit deletion of completed prose is never revived.
              const members = group.members.filter(member =>
                member.playerVariantId === current.playerVariantId &&
                (!member.deleted || member === current && member.failed && !member.assistantMessageId && member.failureReason !== '客户端放弃等待'))
              if (members.includes(current)) failedTurnBranchGroupByTurn[String(activeTurn)] = {
                groupId:group.groupId,currentOrdinal:members.indexOf(current)+1,total:members.length,
                members:members.map((member,index)=>({sessionId:member.sessionId,ordinal:index+1,sourceOrdinal:member.ordinal,kind:member.kind,pending:member.pending===true,failed:member.failed===true})),
              }
            }
          }
        } catch {}
      }
    }
    const { cards, worldbook } = collectBranchRecords(session)
    const activeImport = T.branch.get(importActiveKey(session.id)) ?? null
    const importSourceSessionId = activeImport?.sourceRecordSessionId ?? session.id
    const activeImportRecord = activeImport?.importId
      ? T.branch.get(importRecordKey(importSourceSessionId, activeImport.importId))
      : null
    const versions = T.branch.get(keyOf(session.id, 'versions')) ?? { anchors: {} }
    const flatVersions = []
    for (const [anchor, group] of Object.entries(versions.anchors ?? {})) {
      for (const [i, e] of (group.entries ?? []).entries()) {
        flatVersions.push({
          anchorSeq: Number(anchor),
          turn: Number(e.turn),
          seq: Number(e.seq),
          ordinal: i + 1,
          total: group.entries.length,
        })
      }
    }
    return {
      ok: true,
      preset: 'roleplay',
      sessionId: session.id,
      activity:readRoleplayActivity(session,T.branch.get(preparationRecordKey(session.id)),tavernTasks.activity(session)),
      // The state endpoint is also consumed by the Reader UI.  It must expose
      // the same branch-filtered ledger used for prompt assembly; returning the
      // raw head here leaked post-fork parent facts into an unselected child.
      memory: memoryForContext(session),
      directorNotes: ctx.get('compaction')?.directorNotes?.(session) ?? null,
      contextWindow: cloneContextWindow(contextWindowFor(session)),
      cards,
      worldbook,
      scene: T.scene.get(keyOf(session.id, 'current')) ?? null,
      settings: T.branch.get(keyOf(session.id, 'settings')) ?? null,
      statusSpec: T.status.get(keyOf(session.id, 'spec')) ?? null,
      statusPanel: selectedStatusRecord(session),
      statusGeneration: selectedStatusGeneration(session),
      rules: T.rules.get(keyOf(session.id, 'spec')) ?? null,
      opening: T.opening.get(keyOf(session.id, 'scene')) ?? null,
      cardImport: activeImportRecord
        ? { ...importSummary(activeImportRecord), sourceRecordSessionId: importSourceSessionId }
        : activeImport,
      drafts: [...T.drafts.entries()].filter(([k]) => k.startsWith(`${session.id}__draft__`)).map(([, v]) => ({ draft_id: v?.id, idea: String(v?.idea ?? '').slice(0, 80), modules: Object.keys(v?.modules ?? {}), updatedAt: v?.updatedAt })),
      versions: flatVersions,
      branchGroupsByMessageId,
      userActionsBySeq,
      failedTurnRecoveryByTurn,
      failedTurnBranchGroupByTurn,
      assistantActionAnchorsByTurn,
      internalAssistantMessageIds,
      internalMaintenanceTurns:[...maintenanceTurns].filter(turn=>endedTurns.has(turn)&&!playerTurns.has(turn)&&!assistantActionAnchorsByTurn[String(turn)]),
      deletedBranchMessageIds: deletedBranchMessageIdsFor(session, forkLookup),
      inheritedAssistantMessageIds: inheritedAssistantMessageIdsFor(session, forkLookup),
      // The append-only audit log can contain regenerated/deleted siblings.
      // Reader and memory consumers must address only these authoritative
      // nodes, which are exactly what the next model request sees.
      recordVersions:recordVersionsFor(session),
      surfaceNodes: surfaceEntries(session).map((entry) => ({
        seq: entry.seq,
        kind: entry.kind,
        messageId: entry.messageId,
        turn: entry.turn,
        step: entry.step,
        time: entry.time,
      })),
       decision: normalizeDecisionRecord(T.decision.get(keyOf(session.id, 'current'))),
       userinfo: userValues(session.id),
      lineage: svc.branchLineage(session),
    }
  }

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/roleplay/state',
        methods: ['GET'],
        fetch: async (request) => {
          try {
            const url = new URL(request.url)
            const session = await resolveRoleplaySession(url.searchParams.get('sessionId'))
            if (!session) return jsonResponse(404, { ok: false, error: 'roleplay 会话不存在、无法恢复或并非角色扮演会话' })
            return jsonResponse(200, await readRoleplayState(session))
          } catch (error) {
            return jsonResponse(500, { ok: false, error: String(error?.message ?? error) })
          }
        },
      }),
    'roleplay: route state'
  )

  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/roleplay/activity',methods:['GET'],fetch:async request=>{
    const session=await resolveRoleplaySession(new URL(request.url).searchParams.get('sessionId'))
    if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
    return jsonResponse(200,{ok:true,...readRoleplayActivity(session,T.branch.get(preparationRecordKey(session.id)),tavernTasks.activity(session))})
  }}),'roleplay: lightweight activity and deferred player echo')

  const maintenanceJobs = new Map()
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/roleplay/exchange-rate',methods:['GET','POST'],fetch:async request=>{
    try{const url=new URL(request.url),body=request.method==='POST'?await request.json():null,session=await resolveRoleplaySession(body?.sessionId??url.searchParams.get('sessionId'))
      if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
      if(body){if(body.action!=='sync')throw new Error('未知汇率操作');await exchangeRates.sync(true)}else exchangeRates.refresh()
      return jsonResponse(200,{ok:true,fx:exchangeRates.status()})
    }catch(error){return jsonResponse(400,{ok:false,error:String(error.message)})}
  }}),'roleplay: daily exchange rate route')
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/roleplay/price-catalog',methods:['GET','POST'],fetch:async request=>{
    try{const url=new URL(request.url),body=request.method==='POST'?await request.json():null,session=await resolveRoleplaySession(body?.sessionId??url.searchParams.get('sessionId'))
      if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
      if(body){if(body.action!=='sync')throw new Error('未知目录操作');await priceCatalog.sync(true)}else if(telemetry.prices().autoSync)priceCatalog.refresh()
      const search=(url.searchParams.get('q')??'').slice(0,200).toLowerCase(),requested=JSON.parse(url.searchParams.get('keys')??'[]')
      if(!Array.isArray(requested)||requested.length>500||requested.some(v=>typeof v!=='string'||v.length>800))throw new Error('目录选择无效')
      const all=priceCatalog.state().entries,matching=all.filter(e=>`${e.key} ${e.name}`.toLowerCase().includes(search)).slice(0,100),entries=[...new Map([...all.filter(e=>requested.includes(e.key)),...matching].map(e=>[e.key,e])).values()]
      return jsonResponse(200,{ok:true,catalog:priceCatalog.status(),entries})
    }catch(error){return jsonResponse(400,{ok:false,error:String(error.message)})}
  }}),'roleplay: public price catalog route')
  for(const path of ['/api/roleplay/usage','/api/roleplay/usage-requests','/api/roleplay/logs','/api/roleplay/prices'])ctx.effect(()=>ctx.connection.fetch.register({path,methods:path.endsWith('/prices')?['GET','POST']:['GET'],fetch:async request=>{
    try {
      const url=new URL(request.url),body=request.method==='POST'?await request.json():null
      const session=await resolveRoleplaySession(body?.sessionId??url.searchParams.get('sessionId'))
      if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
      if(path.endsWith('/prices')){
        if(body)await telemetry.savePrices(body.settings,body.expectedRevision)
        if(telemetry.prices().autoSync)priceCatalog.refresh()
        return jsonResponse(200,{ok:true,prices:telemetry.prices(),catalog:priceCatalog.status()})
      }
      const q=Object.fromEntries(url.searchParams),range=timeRange(q)
      const coverage=telemetry.refresh()
      const targetSessionId=q.scope==='all'?null:q.targetSessionId??session.id
      const filter={...range,targetSessionId,provider:q.provider,model:q.model}
      if(path.endsWith('/usage-requests')){
        const prices=telemetry.prices();if(prices.autoSync)priceCatalog.refresh()
        if(q.currency){if(!['USD','CNY'].includes(q.currency))throw new Error('展示币种必须为 USD 或 CNY');if(q.currency!==prices.currency)exchangeRates.refresh()}
        const sessions=telemetry.sessionList()
        return jsonResponse(200,{ok:true,...queryUsageRequests(telemetry.calls(),{...filter,currency:q.currency,offset:q.offset,limit:q.limit},prices,priceCatalog.state().entries,exchangeRates.state(),sessions),sessions,coverage})
      }
      if(path.endsWith('/usage')){
        if(telemetry.prices().autoSync)priceCatalog.refresh()
        let stats=aggregateUsage(telemetry.calls().filter(r=>r.ownerSessionId!==null),filter,telemetry.prices(),priceCatalog.state().entries)
        if(q.currency){if(!['USD','CNY'].includes(q.currency))throw new Error('展示币种必须为 USD 或 CNY');if(q.currency!==stats.currency)exchangeRates.refresh();stats=convertUsageCurrency(stats,q.currency,exchangeRates.state())}
        return jsonResponse(200,{ok:true,...stats,sessions:telemetry.sessionList(),coverage,pricingCatalog:priceCatalog.status()})
      }
      const rows=telemetry.logs().filter(r=>r.ownerSessionId!==null&&(!targetSessionId||r.ownerSessionId===targetSessionId)&&r.startedAt>=range.from&&r.startedAt<range.to&&(!q.kind||r.kind===q.kind)&&(!q.status||r.status===q.status)&&(!q.model||r.model===q.model))
      const offset=Math.max(0,Math.min(1e7,Number(q.offset)||0)),limit=Math.max(1,Math.min(100,Number(q.limit)||50))
      return jsonResponse(200,{ok:true,rows:rows.slice(offset,offset+limit),total:rows.length,offset,limit,sessions:telemetry.sessionList(),coverage})
    }catch(error){return jsonResponse(String(error.message).includes('已更新')?409:400,{ok:false,error:String(error.message)})}
  }}),`roleplay: telemetry route ${path}`)
  const publicJob=job=>{
    const child=job.source?.workflowId?null:[...T.branch.entries()].filter(([key,value])=>key.startsWith('tavern_job__')&&value.source?.workflowId===job.id)
      .map(([,value])=>value).sort((a,b)=>(b.createdAt??0)-(a.createdAt??0))[0]
    return {id:job.id,parentJobId:job.source?.workflowId??null,kind:job.kind,status:job.status,progress:job.progress,
      execution:child?.execution??job.execution,actualRoute:child?.actualRoute??job.actualRoute,
      error:job.error??null,failure:taskValidationFailure(job)??job.failure??null,validationFailures:job.validationFailures??0,
      resourceId:job.resourceId??job.result?.resourceId??null,createdAt:job.createdAt,completedAt:job.completedAt??null,
      failedAt:job.failedAt??(job.status==='failed'?job.updatedAt??null:null)}
  }
  async function startExportJob(session,kind,agent,sourceFile) {
    const job=kind==='novel-export'?await novelExports.begin(session,await modelPolicy.resolve(session,kind,agent))
      :await beginCardWorkflow(session,kind,sourceFile,agent)
    agent.steer(taskPhaseMessage('management','请完成酒馆管理中刚启动的任务。不要续写剧情。',{jobId:job.id,jobKind:kind}))
    return job
  }
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/roleplay/jobs',methods:['GET','POST'],fetch:async request=>{
    try {
      const url=new URL(request.url),body=request.method==='POST'?await request.json():null
      const session=await resolveRoleplaySession(body?.sessionId??url.searchParams.get('sessionId'))
      if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
      if(!body)return jsonResponse(200,{ok:true,jobs:[...cardWorkflows(session),...await novelExports.refresh(session),...tavernTasks.list(session)].map(publicJob)})
      const found=await ctx.sessionController.resolveAgent(session.id),agent=found?.agent
      if(!agent)return jsonResponse(409,{ok:false,error:'当前会话代理尚未就绪'})
      taskAgents.set(session.id,agent)
      if(body.action) {
        if(!['retry','cancel'].includes(body.action))throw new Error('未知任务操作')
        const novel=novelExports.list(session).find(j=>j.id===body.jobId),card=cardWorkflows(session).find(j=>j.id===body.jobId)
        let job
        if(novel)job=await novelExports[body.action](session,body.jobId)
        else if(card){
          if(card.status==='completed')return jsonResponse(200,{ok:true,job:publicJob(card)})
          job={...card,generation:randomUUID(),status:body.action==='cancel'?'cancelled':'queued',error:null};await T.branch.put(cardWorkflowKey(card.id),job)
          if(body.action==='retry')for(const [recordKey,record] of [...T.branch.entries()].filter(([,v])=>v?.workflowId===card.id))await T.branch.put(recordKey,{...record,workflowGeneration:job.generation})
        }
        else job=await tavernTasks[body.action](session,body.jobId)
        if(novel||card)for(const task of tavernTasks.list(session).filter(t=>t.source?.workflowId===job.id&&!['completed','cancelled','stale'].includes(t.status)))await tavernTasks.cancel(session,task.id)
        if(body.action==='retry')agent.steer(taskPhaseMessage('management','继续尚未完成的酒馆任务。'))
        return jsonResponse(200,{ok:true,job:publicJob(job)})
      }
      if(!['novel-export','card-export','card-import'].includes(body.kind))throw new Error('未知任务用途')
      const sourceFile=body.resourceId?libraryFor(session).metadata(body.resourceId).path:body.sourceFile
      const job=await startExportJob(session,body.kind,agent,sourceFile)
      return jsonResponse(202,{ok:true,job:publicJob(job)})
    }catch(error){return jsonResponse(400,{ok:false,error:String(error.message)})}
  }}),'roleplay: persistent jobs route')
  for(const [path,handler] of [
    ['/api/roleplay/resources',async(session)=>{const lib=await migrateResources(session);return jsonResponse(200,{ok:true,resources:lib.list(),pending:lib.pending()})}],
    ['/api/roleplay/resource',async(session,url)=>{const lib=libraryFor(session),id=url.searchParams.get('resourceId'),resource=lib.metadata(id);let text
      if(resource.type==='image/png')text=JSON.stringify(decodeTavernCard(Buffer.from(await lib.openDownload(id).arrayBuffer()),'.png').data,null,2)
      else try{text=lib.read(id).text}catch{}
      return jsonResponse(200,{ok:true,resource,text})}],
    ['/api/roleplay/download',async(session,url)=>libraryFor(session).openDownload(url.searchParams.get('resourceId'))],
  ])ctx.effect(()=>ctx.connection.fetch.register({path,methods:['GET'],fetch:async request=>{
    try{const url=new URL(request.url),session=await resolveRoleplaySession(url.searchParams.get('sessionId'))
      if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
      return await handler(session,url)
    }catch{return jsonResponse(404,{ok:false,error:'资源不存在、损坏或不属于当前工作区'})}
  }}),`roleplay: resource route ${path}`)
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/roleplay/models',methods:['GET','POST'],fetch:async request=>{
    try {
      const url=new URL(request.url), body=request.method==='POST'?await request.json():null
      const session=await resolveRoleplaySession(body?.sessionId??url.searchParams.get('sessionId'))
      if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
      if(body) {
        for(const selected of Object.values(body.settings?.routes??{})) {
          if(!selected?.reasoningEffort)continue
          if(!ctx.llm.resolveModelInfo)throw new Error('当前模型目录不可用，无法验证思考等级；请稍后重试')
          const info=await ctx.llm.resolveModelInfo(selected.provider,selected.model)
          if(!info.reasoning?.efforts?.some(e=>e.id===selected.reasoningEffort))throw new Error(`模型 ${selected.model} 不支持思考等级 ${selected.reasoningEffort}`)
        }
        await modelPolicy.save(session,body.scope,body.settings,body.expectedRevision)
      }
      const data=await modelPolicy.read(session)
      const catalog=[]
      for(const provider of ctx.llm.listProviders?.()??[]) {
        try { for(const model of await ctx.llm.listModels(provider.id)) {
          let reasoning
          try { reasoning=(await ctx.llm.resolveModelInfo?.(provider.id,model.id))?.reasoning }catch{}
          catalog.push({provider:provider.id,model:model.id,label:model.name??model.id,
            ...(Array.isArray(reasoning?.efforts)?{reasoning:{efforts:reasoning.efforts.map(({id,name,description})=>({id,name,...(description?{description}:{})})),...(reasoning.defaultEffort?{defaultEffort:reasoning.defaultEffort}:{})}}:{})})
        } }catch{}
      }
      return jsonResponse(200,{ok:true,...data,catalog})
    }catch(error){return jsonResponse(String(error.message).includes('已更新')?409:400,{ok:false,error:String(error.message)})}
  }}),'roleplay: model policy route')
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/roleplay/character-cluster',methods:['GET','POST'],fetch:async request=>{
    try{
      const url=new URL(request.url),body=request.method==='POST'?await request.json():null
      const session=await resolveRoleplaySession(body?.sessionId??url.searchParams.get('sessionId'))
      if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
      await ensureBranch(session)
      await ctx.get('tavernConversations')?.ready
      if(body){
        const settings=clusterSettings(body.settings)
        const primary=selectedMainRoute(session,taskAgents.get(session.id),ctx.agentDefaultModel.currentSelection())
        for(const selected of [settings.defaultRoute,...Object.values(settings.characters)].filter(Boolean)){
          const route=selected.main?{...primary,...selected}:selected
          const info=await ctx.llm.resolveModelInfo?.(route.provider,route.model)
          if(!info)throw new Error('所选模型不在当前目录中')
          if(route.reasoningEffort&&!info.reasoning?.efforts?.some(e=>e.id===route.reasoningEffort))throw new Error('所选模型不支持该思考等级')
        }
        await characterCluster.save(session,settings,body.expectedRevision)
      }
      return jsonResponse(200,{ok:true,sessionId:session.id,settings:characterCluster.read(session),characters:characterRoster(session).map(({id,name})=>({id,name}))})
    }catch(error){return jsonResponse(String(error.message).includes('已更新')?409:400,{ok:false,error:String(error.message)})}
  }}),'roleplay: character cluster settings')
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/roleplay/memory-settings',methods:['GET','POST'],fetch:async request=>{
    try{
      const url=new URL(request.url),body=request.method==='POST'?await request.json():null
      const session=await resolveRoleplaySession(body?.sessionId??url.searchParams.get('sessionId'))
      if(!session)return jsonResponse(404,{ok:false,error:'角色扮演会话不存在'})
      if(body){
        if(!['global','session'].includes(body.scope))throw new Error('必须指定全局或会话范围')
        if(!body.settings||typeof body.settings!=='object'||Array.isArray(body.settings))throw new Error('记忆设置格式无效')
        const patch={}
        for(const [field,raw] of Object.entries(body.settings)){
          if(!memorySettingFields.includes(field))throw new Error(`未知设置：${field}`)
          const value=raw===null?0:Number(raw),minimum=field==='autoNotesEveryTurns'?1:['contextWindowTokens','continuityTailTokens'].includes(field)?1000:1
          if(!Number.isSafeInteger(value)||value<0||(value>0&&value<minimum))throw new Error(`${field} 必须为至少 ${minimum} 的整数；0 或 null 表示继承`)
          patch[field]=value||null
        }
        if(!Object.keys(patch).length)throw new Error('没有需要保存的字段')
        await withTavernLock(T.branch,body.scope==='global'?'memory-settings-global':`panel-save:${session.id}`,async()=>{
          const policy=memorySettingsPolicy(session.id)
          if(body.expectedRevision!==policy[body.scope].revision)throw new Error('记忆设置已更新，请刷新后重试')
          if(body.scope==='session')await svc.setSettings(session.id,patch)
          else await T.branch.put('memory-settings-global',{schemaVersion:1,settings:{...policy.global.settings,...patch},updatedAt:Date.now()})
        })
      }
      return jsonResponse(200,{ok:true,...memorySettingsPolicy(session.id)})
    }catch(error){return jsonResponse(String(error.message).includes('已更新')?409:400,{ok:false,error:String(error.message)})}
  }}),'roleplay: memory settings policy')
  ctx.effect(()=>ctx.connection.fetch.register({path:'/api/roleplay/card-avatar',methods:['GET'],fetch:async request=>{
    try {
      const session=await resolveRoleplaySession(new URL(request.url).searchParams.get('sessionId'))
      if(!session)return jsonResponse(404,{ok:false,error:'roleplay 会话不存在'})
      await ensureBranch(session); await awaitImportBarrier(session.id)
      const pointer=T.branch.get(importActiveKey(session.id))
      const record=pointer?.importId?T.branch.get(importRecordKey(pointer.sourceSessionId??session.id,pointer.importId)):null
      if(!record?.sourceEnvelope||record.sourceEnvelope.extension!=='.png')return jsonResponse(404,{ok:false,error:'当前角色卡没有 PNG 头像'})
      assertImportRecordIntegrity(record)
      const avatar=decodeTavernCard(Buffer.from(record.sourceEnvelope.base64,'base64'),'.png')
      return new Response(Buffer.from(avatar.avatarBase64,'base64'),{headers:{'content-type':'image/png','cache-control':'private, no-store','x-content-type-options':'nosniff','etag':`"${avatar.avatarSha256}"`}})
    }catch{return jsonResponse(400,{ok:false,error:'角色卡头像来源验证失败'})}
  }}),'roleplay: avatar interface')
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/roleplay/maintenance', methods: ['POST'],
    fetch: async (request) => {
      try {
        const body = await request.json()
        const session = await resolveRoleplaySession(body.sessionId)
        if (!session) return jsonResponse(404, { ok: false, error: '角色扮演会话不存在' })
        if (body.action === 'status') return jsonResponse(200, { ok: true, job: maintenanceJobs.get(session.id) ?? null })
        const active = maintenanceJobs.get(session.id)
        if (['running','waiting-main'].includes(active?.state)) return jsonResponse(200, { ok: true, job: active })
        const found = await ctx.sessionController.resolveAgent(session.id)
        if (!found?.agent || 'error' in found) return jsonResponse(404, { ok: false, error: '会话尚未就绪' })
        if (found.agent.status === 'running') return jsonResponse(409, { ok: false, error: '请等待当前剧情生成结束' })
        const kind = body.action === 'status-rebuild' ? 'status-rebuild' : 'notes'
        const job = { id: randomUUID(), kind, state: 'running', startedAt: Date.now() }
        maintenanceJobs.set(session.id, job)
        Promise.resolve().then(async () => {
          if (kind === 'notes') {
            const engine = found.agent.ctx?.get?.('compaction') ?? ctx.get('compaction')
            if (!engine?.organizeNow) throw new Error('导演笔记服务尚未就绪')
            job.result = await engine.organizeNow(found.agent)
          } else {
            const event = latestStatusEvent(session)
            if (!event) throw new Error('当前分支缺少已完成正文')
            job.atSeq=event.seq
            const result = await runStatusObligation(session, event, 'maintenance', { force: true, agent: found.agent })
            if(result?.state==='waiting-main'){job.state='waiting-main';return}
            if (result?.state !== 'completed' || result.publicationState !== 'published' ||
              selectedStatusRecord(session)?.provenance?.triggerId !== result.trigger.id) {
              throw new Error('状态栏生成或发布未完成，请重试')
            }
            job.result = { triggerId: result.trigger.id, atSeq: event.seq }
          }
          job.state = 'completed'
        }).catch((error) => { job.state = isInlinePending(error)?'waiting-main':'failed'; job.error = isInlinePending(error)?null:String(error?.message ?? error) })
          .finally(() => { job.finishedAt = Date.now() })
        return jsonResponse(202, { ok: true, job })
      } catch (error) { return jsonResponse(500, { ok: false, error: String(error?.message ?? error) }) }
    },
  }), 'roleplay: explicit maintenance jobs')

  // User info is account-local and must be available even before a roleplay
  // Agent is mounted, so /api/roleplay/userinfo is owned exclusively by the
  // profile-level dsh-roleplay-ui Host plugin. Do not redeclare that route in
  // this per-Agent preset.

  // 原生跨 Session 分支：prepare 只解析/冻结目标；register 在 Client
  // 创建 fork（首轮为 fresh roleplay Session）后、发送 prompt 前原子登记。
  async function publishWorldlineSelection(operation,child) {
    const catalog=ctx.get('tavernConversations')
    if(!catalog)return null // Compatibility for non-web fixtures/older hosts.
    await catalog.ready
    await catalog.reserve({sourceSessionId:operation.anchor.sourceSessionId,childSessionId:child.id,operationId:operation.operationId,kind:operation.kind,sourceHash:recordSha256(operation.anchor)})
    return catalog.markReady(child.id)
  }
  async function failWorldlineCatalog(operation) {
    const catalog=ctx.get('tavernConversations'),childId=operation.reservedChildSessionId??operation.childSessionId
    if(!catalog||!childId)return null
    await catalog.ready
    return catalog.fail(childId,operation.operationId)
  }
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/roleplay/branch',
        methods: ['POST'],
        fetch: async (request) => {
          try {
            const body = await request.json()
            const action = String(body?.action ?? '')
            if(action==='select-worldline') {
              const session=await resolveRoleplaySession(body.sessionId),catalog=ctx.get('tavernConversations')
              if(!session||!catalog)return jsonResponse(404,{ok:false,error:'酒馆会话尚未就绪'})
              assertStoryBranchActive(session)
              await catalog.ready
              return jsonResponse(200,{ok:true,conversations:await catalog.activate(session.id),executionSessionId:session.id})
            }
            if(action==='create-worldline')return await withForkMutationLock(`operation:${body.operationId}`,async()=>{
              const operationKey=forkOperationKey(body.operationId),operation=cloneBranchRecord(T.branch.get(operationKey))
              const catalog=ctx.get('tavernConversations')
              if(!operation||!catalog)return jsonResponse(404,{ok:false,error:'世界线操作或酒馆会话目录不存在'})
              if(['failed','aborted'].includes(operation.state)||operation.abortedAt||Date.now()>operation.expiresAt)throw new Error('世界线操作已经失效，请重新发起')
              const source=await resolveRoleplaySession(operation.anchor.sourceSessionId)
              if(!source)throw new Error('源角色扮演会话不可用')
              assertStoryBranchActive(source)
              await catalog.ready
              const failReservation=async(childId)=>{
                if(childId)await catalog.fail(childId,operation.operationId)
                await T.branch.put(operationKey,{...cloneBranchRecord(T.branch.get(operationKey)),state:'failed',failureReason:'世界线创建失败，请重新发起',failedAt:Date.now()})
              }
              const lookupReserved=async(childId)=>{
                if(ctx.sessions.get(childId))return ctx.sessions.get(childId)
                const found=await ctx.sessionController.resolveAgent(childId)
                if(found?.error&&found.error.code!=='session/not-found')throw found.error
                return found?.agent?.session??ctx.sessions.get(childId)??null
              }
              if(operation.reservedChildSessionId) {
                const existing=await lookupReserved(operation.reservedChildSessionId)
                if(existing)return jsonResponse(200,{ok:true,childSessionId:existing.id,conversations:catalog.snapshot()})
                await failReservation(operation.reservedChildSessionId)
                throw new Error('世界线创建已失效，请重新发起')
              }
              const active=await ctx.sessionController.resolveAgent(source.id)
              if(active?.agent?.status&&active.agent.status!=='idle')throw new Error('请等待当前轮次完成后再切换世界线')
              let reservedId=null,reservationCommitted=false
              const reserve=async({sourceSessionId,childSessionId,seedLength})=>{
                if(sourceSessionId!==source.id)throw new Error('原生分支来源不匹配')
                reservedId=childSessionId
                await catalog.reserve({sourceSessionId,childSessionId,operationId:operation.operationId,kind:operation.kind,sourceHash:recordSha256(operation.anchor)})
                await T.branch.put(operationKey,{...operation,reservedChildSessionId:childSessionId,presentation:{schemaVersion:1,kind:'worldline',conversationId:catalog.rootOf(source.id),sourceSessionId,seedLength},reservedAt:Date.now()})
                reservationCommitted=true
              }
              let created
              try {
              if(operation.anchor.previousTurnEndSeq==null) {
                const childSessionId=`session-${randomUUID()}`
                await reserve({sourceSessionId:source.id,childSessionId,seedLength:0})
                created=await ctx.sessionController.create({sessionId:childSessionId,...(source.header?.cwd?{cwd:source.header.cwd}:{}),agentPreset:'roleplay'})
              } else {
                if(typeof ctx.sessionController.forkPrepared!=='function')throw new Error('原生世界线创建支持尚未安装，请刷新或联系维护者')
                created=await ctx.sessionController.forkPrepared({sessionId:source.id,atSeq:operation.anchor.previousTurnEndSeq},reserve)
              }
              if(!created?.sessionId)throw new Error('原生会话未返回世界线标识')
              } catch(error) {
                // A callback rejection precedes native publication. After native
                // creation, preserve a real child so attach failures can resume.
                if(!reservationCommitted||!reservedId||!await lookupReserved(reservedId))await failReservation(reservedId)
                throw error
              }
              return jsonResponse(200,{ok:true,childSessionId:created.sessionId,conversations:catalog.snapshot()})
            })
            if (action === 'prepare') {
              const source = await resolveRoleplaySession(body?.sessionId)
              if (!source) return jsonResponse(404, { ok: false, error: '角色扮演源会话不存在或无法恢复' })
              await reconcileCanonicalPlayerVariants(source, buildForkLookupIndex())
              const kind = body?.kind === 'player-edit' || body?.kind === 'edit'
                ? 'player-edit'
                : body?.kind === 'delete-user'
                  ? 'delete-user'
                  : 'regenerate'
              let requestedMessageId = String(body?.messageId ?? '')
              if (!requestedMessageId && kind === 'regenerate' && durableSeq(body?.userSeq) === null) {
                // A terminal turn-error has no assistant message id. Resolve
                // the newest incomplete player turn as the recovery target.
                const surface = surfaceEvents(source)
                for (let index = surface.length - 1; index >= 0; index -= 1) {
                  const candidate = surface[index]
                  if (candidate?.type !== 'user/message' || candidate.data?.source?.kind !== 'user') continue
                  const context = userForkContext(source, Number(candidate.seq))
                  if (locatePlayerRecoveryTarget(source, Number(candidate.seq))) {
                    body.userSeq = Number(candidate.seq)
                    break
                  }
                }
              }
              if (!requestedMessageId && (kind === 'player-edit' || kind === 'regenerate')) {
                const requestedUserSeq = durableSeq(body?.userSeq)
                if (requestedUserSeq === null) {
                  return jsonResponse(400, { ok: false, error: '缺少玩家消息 seq，无法恢复失败轮次' })
                }
                const playerContext = userForkContext(source, requestedUserSeq)
                const recovery = locatePlayerRecoveryTarget(source, requestedUserSeq)
                requestedMessageId = recovery ? '' : assistantMessageId(playerContext.followingAssistant)
                if (recovery) {
                  // Failed/incomplete turns have no assistant anchor.  Keep the
                  // operation valid by using a synthetic player recovery anchor;
                  // register will create a clean child and replay the prompt.
                  const operationId = randomUUID()
                  const operation = {
                    schemaVersion: 1,
                    operationId,
                    kind,
                    anchor: recovery,
                    promptText: recovery.promptText,
                    createdAt: Date.now(),
                    expiresAt: Date.now() + 15 * 60 * 1000,
                    consumed: false,
                  }
                  await T.branch.put(forkOperationKey(operationId), operation)
                  return jsonResponse(200, {
                    ok: true,
                    operationId,
                    kind,
                    promptText: recovery.promptText,
                    previousTurnEndSeq: recovery.previousTurnEndSeq,
                    sourceTurn: recovery.sourceTurn,
                    recoveryOnly: true,
                  })
                }
              }
              if (!requestedMessageId) {
                return jsonResponse(400, { ok: false, error: '缺少 Agent 回复锚点' })
              }
              const existingPointer = forkPointerFor(source, requestedMessageId)
              const existingGroup = existingPointer?.groupId
                ? hydrateForkGroup(T.branch.get(forkGroupKey(existingPointer.groupId)))
                : null
              const exactMember = existingGroup?.members?.find((member) =>
                member.sessionId === source.id && member.assistantMessageId === requestedMessageId)
              const nearestMember = groupMemberForSession(existingGroup, source, requestedMessageId, { includeDeleted: true })
              if (exactMember?.deleted || (!exactMember && nearestMember?.deleted)) {
                return jsonResponse(409, { ok: false, error: '这个回复版本已经删除；请切换到仍然活动的分支' })
              }
              const anchor = locateForkTarget(source, requestedMessageId)
              const operationId = randomUUID()
              const operation = {
                schemaVersion: 1,
                operationId,
                kind,
                anchor,
                promptText: anchor.promptText,
                createdAt: Date.now(),
                expiresAt: Date.now() + 15 * 60 * 1000,
                consumed: false,
              }
              await T.branch.put(forkOperationKey(operationId), operation)
              return jsonResponse(200, {
                ok: true,
                operationId,
                kind,
                promptText: anchor.promptText,
                previousTurnEndSeq: anchor.previousTurnEndSeq,
                sourceTurn: anchor.sourceTurn,
              })
            }

            if (action === 'register') {
              const operationId = String(body?.operationId ?? '')
              if (!operationId) return jsonResponse(400, { ok: false, error: '缺少分支操作 operationId' })
              return await withForkMutationLock(`operation:${operationId}`, async () => {
              const operationKey = forkOperationKey(operationId)
              const initial = cloneBranchRecord(T.branch.get(operationKey))
              if (!initial) return jsonResponse(404, { ok: false, error: '分支操作不存在或已过期，请重试' })
              const child = await resolveRoleplaySession(body?.childSessionId)
              if (!child) return jsonResponse(404, { ok: false, error: '新分支会话尚未在服务器就绪' })
              if(initial.reservedChildSessionId&&initial.reservedChildSessionId!==child.id)return jsonResponse(409,{ok:false,error:'世界线与预留会话标识不匹配'})
              const promptText = String(body?.promptText ?? '').trim()
              const requestId = initial.kind === 'delete-user' ? '' : String(body?.requestId ?? '').trim()
              if (initial.kind !== 'delete-user' && (!requestId || requestId.length > 256 || /[\u0000-\u001f]/.test(requestId))) {
                return jsonResponse(400, { ok: false, error: '缺少或无效的分支请求 requestId' })
              }
              if (!promptText && initial.kind !== 'delete-user') return jsonResponse(400, { ok: false, error: '修改后的消息不能为空' })
              if (promptText.length > 1_000_000) return jsonResponse(413, { ok: false, error: '消息超过 1,000,000 字符' })
              if (initial.kind === 'regenerate' && promptText !== initial.anchor.promptText) {
                return jsonResponse(409, { ok: false, error: '重新生成必须复用原玩家消息；需要修改请使用编辑按钮' })
              }
              const promptSha256 = sha256(promptText)
              let operation
              try {
                operation = await T.branch.update(operationKey, (current) => {
                  const record = cloneBranchRecord(current)
                  if (!record) throw new Error('分支操作不存在')
                  const state = record.state ?? (record.consumed ? 'registered' : 'prepared')
                  if (state === 'aborted') throw new Error('分支操作已被客户端撤销')
                  if (state === 'failed') throw new Error(record.failureReason || '分支操作已经失败，请重新发起')
                  const sameIdentity =
                    String(record.childSessionId ?? '') === child.id &&
                    String(record.requestId ?? '') === requestId &&
                    String(record.promptSha256 ?? sha256(String(record.promptText ?? '').trim())) === promptSha256
                  if (state === 'registering' || state === 'registered') {
                    if (!sameIdentity) throw new Error('同一分支操作已由不同的会话或请求占用')
                    return record
                  }
                  if (Number(record.expiresAt) < Date.now()) throw new Error('分支操作已过期，请重试')
                  return {
                    ...record,
                    state: 'registering',
                    childSessionId: child.id,
                    requestId,
                    promptText,
                    promptSha256,
                    registeringAt: Date.now(),
                  }
                })
              } catch (error) {
                return jsonResponse(409, { ok: false, error: String(error?.message ?? error) })
              }

              if ((operation.state ?? (operation.consumed ? 'registered' : 'prepared')) === 'registered') {
                return jsonResponse(200, { ok: true, ...(operation.registration ?? {}), promptText: operation.promptText,conversations:await publishWorldlineSelection(operation,child) })
              }

              if (operation.kind === 'delete-user') {
                try {
                  await bootstrapChildBranch(operation, child)
                  const metaKey = keyOf(child.id, 'meta')
                  await T.branch.put(metaKey, {
                    ...(T.branch.get(metaKey) ?? { createdAt: Date.now() }),
                    truncatedFrom: operation.anchor.sourceSessionId,
                    deletedUserMessageId: operation.anchor.sourceUserMessageId,
                    deletedFromTurn: operation.anchor.sourceTurn,
                    updatedAt: Date.now(),
                  })
                  const registration = { truncated: true, childSessionId: child.id }
                  operation = await T.branch.update(operationKey, (current) => ({
                    ...cloneBranchRecord(current),
                    state: 'registered',
                    consumed: true,
                    childSessionId: child.id,
                    registration,
                    registeredAt: Date.now(),
                  }))
                  return jsonResponse(200, { ok: true, ...registration,conversations:await publishWorldlineSelection(operation,child) })
                } catch (error) {
                  try {
                    await T.branch.update(operationKey, (current) => ({
                      ...cloneBranchRecord(current), state: 'failed', failedAt: Date.now(),
                      failureReason: String(error?.message ?? error).slice(0, 500),
                    }))
                  } catch {}
                  await failWorldlineCatalog(operation)
                  throw error
                }
              }
              let registration
              try {
                registration = operation.anchor?.recoveryOnly
                  ? await registerRecoveryFork(operation, child)
                  : await registerNativeFork(operation, child)
                operation = await T.branch.update(operationKey, (current) => {
                  const record = cloneBranchRecord(current)
                  if (String(record?.childSessionId ?? '') !== child.id || String(record?.requestId ?? '') !== requestId) {
                    throw new Error('分支操作登记身份在提交期间发生变化')
                  }
                  return {
                    ...record,
                    state: 'registered',
                    registration,
                    consumed: true,
                    childSessionId: child.id,
                    groupId: registration.groupId,
                    ordinal: registration.ordinal,
                    registeredAt: Date.now(),
                  }
                })
              } catch (error) {
                // Leave a durable failure marker so a dropped response or a
                // service restart cannot make the same operation look fresh;
                // remove only the exact pending member when one was created.
                try {
                  await T.branch.update(operationKey, (current) => ({
                    ...cloneBranchRecord(current), state: 'failed', failedAt: Date.now(),
                    failureReason: String(error?.message ?? error).slice(0, 500),
                  }))
                } catch {}
                await failWorldlineCatalog(operation)
                throw error
              }
              return jsonResponse(200, { ok: true, ...registration, promptText,conversations:await publishWorldlineSelection(operation,child) })
              })
            }

            if (action === 'abort') {
              const operationId = String(body?.operationId ?? '')
              if (!operationId) return jsonResponse(400, { ok: false, error: '缺少分支操作 operationId' })
              return jsonResponse(200, await withForkMutationLock(`operation:${operationId}`, async () => {
                let operation = cloneBranchRecord(T.branch.get(forkOperationKey(operationId)))
                if (!operation) return { ok: false, error: '分支操作不存在或已过期' }
                const failCatalog=async()=>{
                  const catalog=ctx.get('tavernConversations'),childId=operation.childSessionId??operation.reservedChildSessionId
                  if(!catalog||!childId)return null
                  await catalog.ready
                  return catalog.fail(childId,operation.operationId)
                }
                if (operation.abortedAt) return { ok: true, alreadyAborted: true,conversations:await failCatalog() }
                if (operation.groupId && operation.childSessionId) {
                  let requestAlreadyAccepted = false
                  const initialGroup = hydrateForkGroup(T.branch.get(forkGroupKey(operation.groupId)))
                  const abortLockKey = initialGroup?.anchor
                    ? forkAnchorLockKey(initialGroup.anchor)
                    : forkAnchorLockKey(operation.anchor)
                  await withForkMutationLock(abortLockKey, async () => {
                    const group = hydrateForkGroup(T.branch.get(forkGroupKey(operation.groupId)))
                    const member = group?.members?.find((item) =>
                      item.sessionId === operation.childSessionId && Number(item.ordinal) === Number(operation.ordinal))
                    const child = ctx.sessions.get(operation.childSessionId)
                    requestAlreadyAccepted = Boolean(child && operation.requestId && requestUserEvent(child, String(operation.requestId)))
                    if (requestAlreadyAccepted) return
                    if (group && member && member.pending) {
                      member.deleted = true
                      member.pending = false
                      member.failed = true
                      member.failureReason = '客户端放弃等待'
                      member.deletedAt = Date.now()
                      group.updatedAt = Date.now()
                      await T.branch.put(forkGroupKey(group.groupId), group)
                    }
                    await T.branch.delete(forkPendingKey(operation.childSessionId, operation.groupId))
                  })
                  if (requestAlreadyAccepted) {
                    return {
                      ok: true,
                      aborted: false,
                      alreadyAccepted: true,
                      operationId: operation.operationId,
                    }
                  }
                }
                operation = await T.branch.update(forkOperationKey(operation.operationId), (record) => ({
                  ...cloneBranchRecord(record), abortedAt: Date.now(), state: 'aborted',
                }))
                return { ok: true, operationId: operation.operationId,conversations:await failCatalog() }
              }))
            }

            if (action === 'operation-status') {
              const operation = cloneBranchRecord(T.branch.get(forkOperationKey(body?.operationId)))
              if (!operation) return jsonResponse(404, { ok: false, error: '分支操作不存在或已过期' })
              if (operation.state === 'failed' || operation.state === 'aborted') {
                await failWorldlineCatalog(operation)
                return jsonResponse(200, { ok: true, status: 'failed', error: operation.failureReason ?? '分支操作已失败' })
              }
              if (operation.kind === 'delete-user' && operation.consumed && operation.registration?.truncated) {
                return jsonResponse(200, {
                  ok: true,
                  status: 'completed',
                  operationState: operation.state ?? 'registered',
                  registered: true,
                  childSessionId: operation.childSessionId,
                  truncated: true,
                })
              }
              if (!operation.consumed || !operation.childSessionId || !operation.groupId) {
                return jsonResponse(200, {
                  ok: true,
                  status: operation.state === 'registering' ? 'pending' : 'prepared',
                  operationState: operation.state ?? 'prepared',
                  registered: false,
                  requestAccepted: false,
                })
              }
              const child = await resolveRoleplaySession(operation.childSessionId)
              if (child) await reconcileNativeFork(child)
              const group = hydrateForkGroup(T.branch.get(forkGroupKey(operation.groupId)))
              const member = group?.members?.find((item) =>
                item.sessionId === operation.childSessionId && Number(item.ordinal) === Number(operation.ordinal))
              if (!member) return jsonResponse(409, { ok: false, error: '分支成员索引缺失' })
              const status = member.failed || (member.deleted && !member.assistantMessageId)
                ? 'failed'
                : member.pending
                  ? 'pending'
                  : member.assistantMessageId
                    ? 'completed'
                    : 'pending'
              return jsonResponse(200, {
                ok: true,
                status,
                operationState: operation.state ?? 'registered',
                registered: true,
                requestAccepted: child ? Boolean(requestUserEvent(child, String(operation.requestId ?? ''))) : false,
                childSessionId: operation.childSessionId,
                assistantMessageId: member.assistantMessageId ?? null,
                error: status === 'failed' ? String(member.failureReason ?? '分支生成失败') : undefined,
              })
            }

            if (action === 'delete') {
              const session = await resolveRoleplaySession(body?.sessionId)
              if (!session) return jsonResponse(404, { ok: false, error: '角色扮演会话不存在或无法恢复' })
              const messageId = String(body?.messageId ?? '')
              const pointer = forkPointerFor(session, messageId)
              const initialGroup = pointer?.groupId ? hydrateForkGroup(T.branch.get(forkGroupKey(pointer.groupId))) : null
              if (!initialGroup) return jsonResponse(404, { ok: false, error: '这条回复尚未形成可删除的分支组' })
              return withForkMutationLock(forkAnchorLockKey(initialGroup.anchor), async () => {
                const group = hydrateForkGroup(T.branch.get(forkGroupKey(initialGroup.groupId)))
                if (!group) return jsonResponse(404, { ok: false, error: '分支组已被移除，请刷新后重试' })
                const exactMember = groupMemberForSession(group, session, messageId, { includeDeleted: true })
                if (exactMember?.deleted && exactMember.deleteResult) {
                  const activeNow = group.members.filter((member) => !member.deleted)
                  const preferred = activeNow.find((member) => member.sessionId === exactMember.deleteResult.nextSessionId)
                    ?? activeNow[0]
                  if (!preferred) return jsonResponse(409, { ok: false, error: '分支组已没有可切换的活动版本' })
                  return jsonResponse(200, {
                    ok: true,
                    ...exactMember.deleteResult,
                    nextSessionId: preferred.sessionId,
                    remaining: activeNow.length,
                    alreadyDeleted: true,
                  })
                }
                const active = group.members.filter((member) => !member.deleted)
                if (active.length <= 1) return jsonResponse(409, { ok: false, error: '至少保留一个可用分支；请先重新生成，再删除不需要的版本' })
                const victimMember = exactMember
                const index = active.findIndex((member) => member === victimMember)
                if (index < 0) return jsonResponse(409, { ok: false, error: '当前回复不属于该活动分支组' })
                const victim = active[index]
                const next = active[index + 1] ?? active[index - 1]
                victim.deleted = true
                victim.deletedAt = Date.now()
                victim.deleteResult = {
                  nextSessionId: next.sessionId,
                  remaining: active.length - 1,
                  deletedOrdinal: index + 1,
                }
                group.updatedAt = Date.now()
                await T.branch.put(forkGroupKey(group.groupId), group)
                return jsonResponse(200, {
                  ok: true,
                  ...victim.deleteResult,
                })
              })
            }

            if (action === 'replace-message') {
              const session = await resolveRoleplaySession(body?.sessionId)
              if (!session) return jsonResponse(404, { ok: false, error: '角色扮演会话不存在或无法恢复' })
              const text = String(body?.text ?? '').trim()
              if (!text) return jsonResponse(400, { ok: false, error: '消息不能为空' })
              if (text.length > 1_000_000) return jsonResponse(413, { ok: false, error: '消息超过 1,000,000 字符' })
              if (body?.role === 'assistant') {
                const messageId = String(body?.messageId ?? '')
                if (!messageId) return jsonResponse(400, { ok: false, error: '缺少 Agent messageId' })
                const replacement = await replaceAssistantText(session, messageId, text)
                return jsonResponse(200, { ok: true, seq: Number(replacement.seq), messageId })
              }
              if (body?.role === 'user') {
                const seq = Number(body?.seq)
                if (!Number.isSafeInteger(seq) || seq < 0) return jsonResponse(400, { ok: false, error: '玩家消息 seq 无效' })
                const result = await replaceUserText(session, seq, text)
                return jsonResponse(200, { ok: true, ...result })
              }
              return jsonResponse(400, { ok: false, error: 'role 必须是 user 或 assistant' })
            }

            return jsonResponse(400, { ok: false, error: `未知 branch action: ${action}` })
          } catch (error) {
            return jsonResponse(error?.code==='ROLEPLAY_NOT_STORY'?400:500, { ok: false, error: String(error?.message ?? error) })
          }
        },
      }),
    'roleplay: route native branch'
  )

  // 轮末决策卡：玩家点选后标记已答；前端随即以「我选择：…」用户消息开启下一轮。
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/roleplay/decision',
        methods: ['POST'],
        fetch: async (request) => {
          try {
            const body = await request.json()
            const session = await resolveRoleplaySession(body?.sessionId)
            if (!session) return jsonResponse(404, { ok: false, error: 'roleplay 会话不存在或无法恢复' })
            return await withDecisionMutationLock(session.id, async () => {
              const key = keyOf(session.id, 'current')
              const rec = normalizeDecisionRecord(T.decision.get(key))
              if (!rec || rec.answered || rec.superseded) return jsonResponse(409, { ok: false, error: '没有待处理的决策卡' })
              const idx = body?.choiceIndex !== undefined ? Number(body.choiceIndex) : -1
              const customText = typeof body?.customText === 'string' ? body.customText.trim().slice(0, 500) : ''
              const isCustom = customText !== ''
              if (!isCustom && (!Number.isInteger(idx) || idx < 0 || idx >= rec.options.length)) return jsonResponse(400, { ok: false, error: 'choiceIndex 无效' })
              const label = isCustom ? customText : rec.options[idx].label
              await T.decision.put(key, {
                ...rec,
                answered: true,
                choiceIndex: isCustom ? null : idx,
                choiceLabel: label,
                customText: isCustom ? customText : undefined,
                answeredAt: Date.now(),
              })
              return jsonResponse(200, { ok: true, label })
            })
          } catch (error) {
            return jsonResponse(500, { ok: false, error: String(error?.message ?? error) })
          }
        },
      }),
    'roleplay: route decision'
  )

  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/roleplay/set',
        methods: ['POST'],
        fetch: async (request) => {
          let body
          try {
            body = await request.json()
          } catch {
            return jsonResponse(400, { ok: false, error: '请求体必须是 JSON' })
          }
          try {
            const session = await resolveRoleplaySession(body?.sessionId)
            if (!session) return jsonResponse(404, { ok: false, error: 'roleplay 会话不存在或无法恢复' })
            await ensureBranch(session)
            const atSeq = lastSeq(session)
            const kind = body?.kind

            return await withTavernLock(T.branch,`panel-save:${session.id}`,async()=>{
            if(body.expectedRevision!==undefined) {
              const versions=recordVersionsFor(session)
              const expected=kind==='card' ? versions.cards[body.card_id]??'missing'
                : kind==='worldbook'||kind==='worldbook-delete' ? versions.worldbook[body.id]??'missing' : versions[kind]
              if(expected!==body.expectedRevision)return jsonResponse(409,{ok:false,error:'设定已在其他操作中更新。已保留草稿，请重新载入后合并。'})
            }

            if (kind === 'card') {
              const cardId = String(body.card_id ?? '')
              if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cardId)) return jsonResponse(400, { ok: false, error: 'card_id 只能包含字母/数字/下划线/连字符' })
              const prev = T.cards.get(keyOf(session.id, cardId)) ?? {}
              const card = {
                ...prev, schemaVersion:1, verified:false,
                editedFrom:{sha256:recordSha256(prev),source:'user-edit',seq:atSeq},
                id: cardId,
                name: body.name ?? prev.name ?? cardId,
                kind: body.card_kind ?? prev.kind ?? (cardId === 'user' ? 'user' : 'npc'),
                content: body.content !== undefined ? String(body.content) : prev.content ?? '',
                locked: body.locked !== undefined ? body.locked === true : prev.locked === true,
                version: (Number(prev.version) || 0) + 1,
                updatedAtSeq: atSeq,
              }
              await T.cards.put(keyOf(session.id, cardId), card)
            } else if (kind === 'worldbook') {
              const id = String(body.id ?? '')
              if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return jsonResponse(400, { ok: false, error: '条目 id 只能包含字母/数字/下划线/连字符' })
              const prev = T.worldbook.get(keyOf(session.id, id)) ?? {}
              const entry = {
                ...prev, schemaVersion:1, verified:false,
                editedFrom:{sha256:recordSha256(prev),source:'user-edit',seq:atSeq},
                id,
                kind: body.entry_kind ?? prev.kind ?? 'term',
                name: body.name ?? prev.name ?? id,
                aliases: Array.isArray(body.aliases) ? body.aliases.map(String) : prev.aliases ?? [],
                keywords: Array.isArray(body.keywords) ? body.keywords.map(String) : prev.keywords ?? [],
                triggers: Array.isArray(body.triggers) ? body.triggers.map(String) : prev.triggers ?? [],
                priority: body.priority !== undefined ? Number(body.priority) || 0 : prev.priority ?? 0,
                tokenBudget: body.token_budget !== undefined ? Number(body.token_budget) || 400 : prev.tokenBudget ?? 400,
                alwaysOn: body.always_on !== undefined ? body.always_on === true : prev.alwaysOn === true,
                content: body.content !== undefined ? String(body.content) : prev.content ?? '',
                locked: body.locked !== undefined ? body.locked === true : prev.locked === true,
                version: (Number(prev.version) || 0) + 1,
                updatedAtSeq: atSeq,
              }
              await T.worldbook.put(keyOf(session.id, id), entry)
            } else if (kind === 'worldbook-delete') {
              await T.worldbook.delete(keyOf(session.id, String(body.id ?? '')))
            } else if (kind === 'memory') {
              const patch = {}
              if (body.summary !== undefined && body.directorNotes === true) {
                const engine = ctx.get('compaction')
                if (!engine?.saveDirectorNotes) throw new Error('导演笔记服务尚未就绪')
                await engine.saveDirectorNotes(session, body.summary)
              } else if (body.summary !== undefined) patch.summary = String(body.summary)
              if (Array.isArray(body.lockedFacts)) patch.lockedFacts = body.lockedFacts.map((f) => (typeof f === 'string' ? { text: f } : f))
              await svc.memoryUpdate(session.id, patch)
            } else if (kind === 'settings') {
              const patch = {}
              if (body.targetContextTokens !== undefined) patch.targetContextTokens = Math.max(0, Number(body.targetContextTokens) || 0)
              if (body.archiveTokens !== undefined) patch.archiveTokens = Math.max(0, Number(body.archiveTokens) || 0)
              for(const field of ['contextWindowTokens','continuityTailTokens'])if(body[field]!==undefined){
                const value=body[field]===null?0:Number(body[field])
                if(!Number.isSafeInteger(value)||value<0||(value>0&&value<1000))throw new Error(`${field} 必须为至少 1000 的整数；0 或 null 表示继承全局值`)
                patch[field]=value||null
              }
              await svc.setSettings(session.id, patch)
            } else if (kind === 'status') {
              if (body.text !== undefined) await svc.setStatusSpec(session.id, String(body.text), atSeq)
            } else if (kind === 'rules') {
              const prev = T.rules.get(keyOf(session.id, 'spec')) ?? {}
              const next = { ...prev,verified:false,editedFrom:{sha256:recordSha256(prev),source:'user-edit',seq:atSeq} }
              for (const f of RULE_TEXT_FIELDS) {
                if (body[f] !== undefined) next[f] = String(body[f])
              }
              if (body.beauty !== undefined) {
                const b = body.beauty
                const regexRules = Array.isArray(b?.regexRules)
                  ? b.regexRules
                      .filter((r) => r && typeof r === 'object' && typeof r.match === 'string' && typeof r.replace === 'string')
                      .slice(0, 60)
                      .map((r) => ({ match: String(r.match).slice(0, 400), replace: String(r.replace).slice(0, 800) }))
                  : []
                next.beauty = {
                  regexRules,
                  css: typeof b?.css === 'string' ? b.css.slice(0, 20000) : '',
                  js: typeof b?.js === 'string' ? b.js.slice(0, 8000) : '',
                }
              }
              await svc.setRules(session.id, next, atSeq)
            } else if (kind === 'opening') {
              if (body.text !== undefined) await svc.setOpening(session.id, String(body.text), atSeq)
            } else {
              return jsonResponse(400, { ok: false, error: `未知 kind: ${String(kind)}` })
            }
            return jsonResponse(200, await readRoleplayState(session))
            })
          } catch (error) {
            return jsonResponse(500, { ok: false, error: String(error?.message ?? error) })
          }
        },
      }),
    'roleplay: route set'
  )

  ctx.logger?.info?.('roleplay-core: mounted')
}

