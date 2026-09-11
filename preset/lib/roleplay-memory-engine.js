// roleplay-memory-engine.js — roleplay preset 的记忆/压缩引擎。
//
// 提供本 preset isolate group 内的 `compaction` 服务（command-compact 与
// 本引擎的 /memory organize 消费），并实现：
//   - 自动触发：完整请求压力达到 targetContextTokens 减去 hysteresisTokens
//     的安全线（默认 256K - 16K）时，归档最早约 archiveTokens 的未归档
//     剧情区间，尾部保留原文；
//   - 增量摘要：基于当前分支可见的上一代 checkpoint 合并新剧情；
//   - 隔离设定：角色卡、世界书、规则和工具上下文永不进入摘要范围；
//     只有用户在记忆面板显式锁定的剧情事实会逐字进入摘要；
//   - 原文与摘要均带精确 source seq 指针；原始事件永远保留（surface 替换
//     只遮蔽模型可见面，人类转录永不删除）。
//
// 事件序列镜像 compaction-basic（compaction/start → compaction/summary →
// user/message surface replace → compaction/end），token meter 的
// shadow-price 记账协议因此继续成立。
//
// 与 roleplay-core.js 相同：本文件不能裸 import 任何 npm 包。

import { createHash, randomUUID } from 'node:crypto'

export const name = 'roleplay-memory-engine'

export const inject = ['sessions', 'llm', 'tokenMeter', 'agentDefaultModel']

const DEFAULT_CONFIG = {
  targetContextTokens: 262144,
  archiveTokens: 100000,
  maxSummaryTokens: 16384,
  summaryTimeoutMs: 300000,
  notesBatchChars: 100000,
  autoNotes: true,
  autoNotesEveryTurns: 3,
  autoNotesTimeoutMs: 300000,
  autoRetryBaseMs: 30000,
  autoRetryMaxMs: 300000,
  auto: true,
  hysteresisTokens: 16384,
}

const SUMMARY_SYSTEM =
  '你是角色扮演工作台的记忆整理员。基于既有记忆与待归档的原文区间，生成增量记忆摘要。' +
  '**核心原则：详细保留，不以节约 tokens 为目的。目标是让 AI 拿到尽可能充分的故事信息，同时避免原文阻塞注意力窗口。**' +
  '\n输出 Markdown，严格按以下 8 段组织，缺失内容写「无」：' +
  '\n1. 用户锁定的剧情事实（必须一字不差地保留下方给定的用户锁定事实；这里不收录角色卡或世界书）' +
  '\n2. 主角与用户边界（用户明确表达的偏好、底线、纠正）' +
  '\n3. 角色簿（**详细记录**：姓名/别名/身份/外貌特征/穿搭细节/性格特质/口吻习惯/能力/动机/秘密/恐惧/软肋/目标/行为模式）' +
  '\n4. 关系图（**详细记录关系演变**：有向关系类型/当前阶段/关键亲密节点/冲突与和解/嫉妒/秘密/承诺/未来约定 + 变化的具体证据与台词）' +
  '\n5. 世界规则（**完整保留设定**：现实/平行边界、国家体制、城市地理、学校/组织架构、技术水平、经济政治规则、魔法/超能力系统、公开与秘密状态）' +
  '\n6. 时间线与剧情账本（**详细剧情脉络**：精确日期/学期进度/地点转换/天气/在场人物/事件触发条件/行动细节/结果/长期后果/伏笔/已兑现与未兑现约定）' +
  '\n7. 当前场景快照（**当前状态快照**：精确位置/每个角色的服装状态/道具持有/身体状态/情绪细节/进行中动作/环境氛围）' +
  '\n8. 核心矛盾、伏笔、未解决问题、用户否定过的分支、待确认事项（**保留所有伏笔与未解决线索**）' +
  '\n**记录要求**：' +
  '\n- 每条信息末尾附 (seq:来源序号)' +
  '\n- 保留专名、数字、具体地点、先后顺序、因果链、关键台词与用户明确更正' +
  '\n- 剧情细节优先：人物重要行为、关系变化、势力动向、新增设定等全部详细记录' +
  '\n- 一次性描写不得升级为永久规则' +
  '\n- 宁可详细，不可精简：目标是高质量长流程 RP，不是节约 tokens' +
  '\n- 只整理剧情。不得把角色卡、世界书、叙事规则、状态栏模板、工具输出或后台提示复制进摘要；这些材料由独立存储按需注入'

function lastSeqOf(session) {
  if (Number.isSafeInteger(session?.seq)) return Number(session.seq) - 1
  const events = eventsOf(session)
  return events.length > 0 ? Number(events.at(-1)?.seq ?? events.length - 1) : -1
}

function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / 2.5)
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

/**
 * Read the branch boundary used by the native Session fork contract.
 *
 * A child owns events at/after `seedLength`; the inherited prefix is the only
 * place where an item written by an ancestor may be trusted.  Treat a child
 * with a missing or malformed boundary as an unsafe branch instead of
 * silently treating it as a root session (which would expose the parent's
 * future ledger).
 */
function branchScope(session) {
  const parent = typeof session?.header?.parentSession === 'string'
    ? session.header.parentSession.trim()
    : ''
  if (!parent) return { isFork: false, seedLength: null }
  const raw = session.header?.seedLength
  const seedLength = Number.isSafeInteger(raw) && raw >= 0 ? raw : null
  return { isFork: true, seedLength }
}

function durableSeq(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null
}

/** Return the first durable event sequence which can prove provenance. */
function provenanceSeqOf(item) {
  if (!item || typeof item !== 'object') return null
  const candidates = [
    item.atSeq,
    item.evidenceSeq,
    item.updatedAtSeq,
    item.checkpointSeq,
    item.summaryAtSeq,
    item.summarySeq,
    item.sourceSeq,
    item.seq,
    item.range?.end,
  ]
  for (const candidate of candidates) {
    const seq = durableSeq(candidate)
    if (seq !== null) return seq
  }
  return null
}

/** Whether one ledger item is owned by this branch or its inherited prefix. */
function belongsToBranch(item, session, scope = branchScope(session)) {
  if (!scope.isFork) return true
  if (!item || typeof item !== 'object') return false
  const branchId = String(session?.id ?? '')
  const owners = [item.sessionId, item.branchId, item.ownerSessionId]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
  // Conflicting owner aliases are corruption, not permission. Only an
  // unambiguous child owner bypasses the inherited-prefix boundary.
  if (branchId && owners.length > 0 && owners.every((owner) => owner === branchId)) return true
  const seq = provenanceSeqOf(item)
  return scope.seedLength !== null && seq !== null && seq < scope.seedLength
}

/** Filter a ledger array without mutating the stored record. */
function scopedLedgerItems(items, session, scope = branchScope(session)) {
  const list = Array.isArray(items) ? items : []
  return list.filter((item) => belongsToBranch(item, session, scope))
}

function summarySeqOf(record) {
  if (!record || typeof record !== 'object') return null
  // These fields specifically describe the checkpoint represented by
  // `summary`. Do not use a generic updatedAt wall-clock value as proof.
  for (const key of ['summaryAtSeq', 'summarySeq', 'surfaceCheckpointSeq', 'lastCompactedSeq']) {
    const seq = durableSeq(record[key])
    if (seq !== null) return seq
  }
  return null
}

function inheritedSummaryIsSafe(record, session, scope, seq) {
  if (!scope.isFork || scope.seedLength === null) return false
  const parent = typeof session?.header?.parentSession === 'string'
    ? session.header.parentSession.trim()
    : ''
  const inheritedFrom = String(record?.inheritedFrom ?? '').trim()
  const inheritedAt = record?.inheritedAtSeedLength
  if (!parent || inheritedFrom !== parent ||
    !Number.isSafeInteger(inheritedAt) || inheritedAt !== scope.seedLength) return false
  // A marker without a sequence is still a durable snapshot made by the
  // native fork copier.  If a sequence is present, it must point into the
  // inherited prefix; a post-fork sequence cannot be rescued by the marker.
  return seq === null || seq < scope.seedLength
}

/**
 * Select a summary which is safe for one branch.
 *
 * A visible compact checkpoint always wins: it is part of the exact surface
 * sent to the model.  If a lazy/partial load does not expose that checkpoint,
 * a copied ledger summary is accepted only when its owner is this child or a
 * durable checkpoint sequence lies strictly inside the inherited seed.  An
 * unproven child summary is intentionally blank (fail closed).
 */
function safeSummaryForBranch(record, session, checkpoint, scope = branchScope(session)) {
  const visibleText = String(checkpoint?.text ?? '').trim()
  if (visibleText) {
    return {
      text: visibleText,
      seq: durableSeq(checkpoint?.seq),
      source: 'surface',
    }
  }

  const text = String(record?.summary ?? '').trim()
  if (!text) return { text: '', seq: null, source: 'none' }
  if (!scope.isFork) {
    return { text, seq: summarySeqOf(record), source: 'ledger' }
  }

  const branchId = String(session?.id ?? '')
  // `record.sessionId` is the owner of the *head update*, not necessarily the
  // embedded summary. Phase B legitimately rewrites it without touching the
  // summary, so it must never attest summary provenance.
  const owners = [record?.summarySessionId, record?.summaryBranchId]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
  const seq = summarySeqOf(record)
  if (branchId && owners.length > 0 && owners.every((owner) => owner === branchId)) {
    return { text, seq, source: 'child-ledger' }
  }
  if (scope.seedLength !== null && seq !== null && seq < scope.seedLength) {
    return { text, seq, source: 'seed-ledger' }
  }
  if (inheritedSummaryIsSafe(record, session, scope, seq)) {
    return { text, seq, source: 'inherited-ledger' }
  }
  return { text: '', seq: null, source: 'unproven' }
}

/**
 * Project one memory ledger onto the currently selected branch.
 *
 * This is exported as a small pure seam so the persistence boundary can be
 * regression-tested without booting a full Harness.  The apply() path uses
 * the same function, so tests cannot accidentally exercise a different filter.
 */
export function filterMemoryRecordForBranch(record, session, checkpoint = null) {
  const hasRecord = record && typeof record === 'object' && !Array.isArray(record)
  if (!hasRecord && !checkpoint?.text) return null
  const source = hasRecord ? structuredClone(record) : {}
  const scope = branchScope(session)
  const summary = safeSummaryForBranch(source, session, checkpoint, scope)
  const result = {
    ...source,
    summary: summary.text,
    archives: scopedLedgerItems(source.archives, session, scope),
    archiveDigests: scopedLedgerItems(source.archiveDigests, session, scope),
    deltas: scopedLedgerItems(source.deltas, session, scope),
    pendingConfirmations: scopedLedgerItems(source.pendingConfirmations, session, scope),
    lockedFacts: scopedLedgerItems(source.lockedFacts, session, scope),
    styleNotes: scopedLedgerItems(source.styleNotes, session, scope),
    userPrefs: scopedLedgerItems(source.userPrefs, session, scope),
  }
  if (summary.seq !== null) result.surfaceCheckpointSeq = summary.seq
  else if (scope.isFork) result.surfaceCheckpointSeq = null
  // A copied parent's high watermark must not make a child appear compacted
  // beyond its actual visible checkpoint.
  if (scope.isFork) result.lastCompactedSeq = summary.seq ?? -1
  return result
}

function surfaceSeqsOf(session) {
  const nodes = session?.surface?.nodes
  if (!nodes || typeof nodes[Symbol.iterator] !== 'function') return []
  // Do not coerce null/empty strings to seq 0. A malformed projection must
  // omit the node rather than point at an unrelated event.
  return Array.from(nodes).filter((value) => durableSeq(value) !== null)
}

function contentOfEvent(event) {
  if (event?.type === 'user/message') return event.data?.content
  if (event?.type === 'assistant/message') return event.data?.message?.content ?? event.data?.content
  return []
}

function importManagementInputs(session) {
  const inputs = new Map(), management = new Set()
  const exportTurns = new Set()
  let authoring = false
  let turn = null
  for (const event of eventsOf(session)) {
    if (event.type === 'turn/start') turn = Number(event.data?.turn)
    if (event.type === 'user/message' && event.data?.source?.kind === 'user' && turn !== null) inputs.set(turn,event.seq)
    if (event.type === 'tool/call' && event.data?.name === 'rp_card_import_begin') {
      const seq = inputs.get(Number(event.data?.turn))
      if (Number.isSafeInteger(seq)) management.add(seq)
    }
    if(event.type==='tool/call'&&event.data?.name==='rp_card_draft_check')authoring=true
    if(event.type==='tool/call'&&['rp_card_import_begin','rp_commit_card'].includes(event.data?.name))authoring=false
    if(event.type==='user/message'&&event.data?.source?.plugin==='roleplay-tasks'&&event.data.source.stage==='after-story')authoring=false
    if(authoring&&event.type==='tool/call'&&event.data?.name==='ask_user_question')exportTurns.add(Number(event.data?.turn??turn))
    if(event.type==='tool/call' && /^(?:rp_card_export_(begin|chunk|finalize)|rp_novel_export|rp_diagnose|rp_card_draft_check)$/.test(event.data?.name??''))exportTurns.add(Number(event.data?.turn??turn))
    if(event.type==='user/message'&&event.data?.source?.plugin==='roleplay-tasks'&&['card-export','novel-export'].includes(event.data?.source?.jobKind))exportTurns.add(turn)
    if (event.type === 'turn/end') turn = null
  }
  for(const event of eventsOf(session)) {
    if(event.type==='assistant/message'&&exportTurns.has(Number(event.data?.turn)))management.add(event.seq)
  }
  for(const turnId of exportTurns){const seq=inputs.get(turnId);if(Number.isSafeInteger(seq))management.add(seq)}
  return management
}

function isStoryEvent(event, canonicalAssistantSeqs = null, management = new Set()) {
  if (!event) return false
  if(management.has(event.seq))return false
  if (event.type === 'assistant/message') {
    return event.data?.interrupted !== true &&
      textOf(contentOfEvent(event)).trim().length > 0 &&
      (canonicalAssistantSeqs === null || canonicalAssistantSeqs.has(Number(event.seq)))
  }
  if (event.type !== 'user/message') return false
  return event.data?.source?.kind === 'user' && !management.has(event.seq) && textOf(contentOfEvent(event)).trim().length > 0
}

function isCompletedTurnEnd(event) {
  // Fail closed: aborted/error/interrupted/max-tokens output is not canonical
  // narrative. Only an explicitly completed turn may contribute its closing
  // assistant message or serve as an archive boundary.
  return event?.type === 'turn/end' && event.data?.reason?.kind === 'completed'
}

/**
 * A roleplay-tasks after-story phase is emitted only after the core has chosen
 * and appended its visible story response.  It is therefore a narrow durable
 * completion proof for that exact assistant sequence when later maintenance
 * ends the enclosing turn as aborted.  Do not infer this from text or turn
 * state: malformed, hidden, interrupted, cross-turn, or off-surface markers
 * are ignored.
 */
function afterStoryProofs(session, visible = new Set(surfaceSeqsOf(session))) {
  const log = eventsOf(session), committed = new Set(), turns = new Set()
  for (const marker of log) {
    const source = marker?.type === 'user/message' ? marker.data?.source : null
    if (source?.kind !== 'plugin' || source?.plugin !== 'roleplay-tasks' || source?.form !== 'phase' || source?.stage !== 'after-story') continue
    const seq = Number(source.storySeq), turn = Number(source.turn)
    const story = Number.isSafeInteger(seq) ? log[seq] : null
    if (!visible.has(Number(marker.seq)) || !visible.has(seq) || Number(marker.seq) <= seq ||
      !story || story.type !== 'assistant/message' || Number(story.seq) !== seq ||
      story.data?.interrupted === true || !textOf(contentOfEvent(story)).trim() ||
      !Number.isFinite(turn) || Number(story.data?.turn) !== turn) continue
    committed.add(seq); turns.add(turn)
  }
  return { committed, turns }
}

function canonicalAssistantSeqsOf(session, seqs = surfaceSeqsOf(session)) {
  const visible = new Set(seqs)
  const internal = new Set()
  let inTask=false
  for(const event of eventsOf(session)) {
    if(event?.type==='turn/start'||event?.type==='turn/end')inTask=false
    if(event?.type==='user/message'&&event.data?.source?.kind==='plugin'&&event.data?.source?.plugin==='roleplay-tasks'&&event.data?.source?.form==='phase')inTask=event.data.source.stage!=='story'
    if(inTask&&event?.type==='assistant/message')internal.add(event.seq)
  }
  const completedTurns = new Set(eventsOf(session)
    .filter(isCompletedTurnEnd)
    .map((event) => Number(event.data?.turn)))
  const afterStory = afterStoryProofs(session, visible)
  const lastByTurn = new Map()
  for (const event of eventsOf(session)) {
    if (event?.type !== 'assistant/message' ||
      !visible.has(Number(event.seq)) ||
      internal.has(event.seq) ||
      event.data?.interrupted === true ||
      !textOf(contentOfEvent(event)).trim()) continue
    const turn = Number(event.data?.turn)
    if (afterStory.committed.has(Number(event.seq))) lastByTurn.set(turn, Number(event.seq))
    // A durable after-story proof chooses the exact visible body. Never let
    // earlier tool commentary (or any other same-turn assistant output) become
    // a second canonical response merely because the enclosing turn completed.
    else if (afterStory.turns.has(turn)) continue
    else if (Number.isFinite(turn) && completedTurns.has(turn)) lastByTurn.set(turn, Number(event.seq))
  }
  return new Set(lastByTurn.values())
}

/** Restore only archived plot on the selected surface, never edited/deleted alternatives. */
const selectedStoryCache = new WeakMap()
const immutableStoryValues = new WeakSet()
const storyDataTypes = new Set(['turn/start','turn/end','user/message','assistant/message','tool/call','compaction/end','compaction/summary'])
function immutableStoryValue(value) {
  if (value === null || typeof value !== 'object') return true
  if (immutableStoryValues.has(value)) return true
  if (!Object.isFrozen(value) || !Object.values(value).every(immutableStoryValue)) return false
  immutableStoryValues.add(value)
  return true
}
function expandedHistorySeqs(session) {
  const log = eventsOf(session), surface = surfaceSeqsOf(session)
  const ended = new Set(log.filter((event) => event?.type === 'compaction/end' && !event.data?.error)
    .map((event) => String(event.data?.compactionId ?? '')))
  const summaries = new Map(log.filter((event) => event?.type === 'compaction/summary')
    .map((event) => [String(event.data?.compactionId ?? ''), event]))
  const expanded = []
  const visited = new Set()
  const expand = (seq, depth = 0) => {
    if (durableSeq(seq) === null || visited.has(seq) || depth > 256) return
    visited.add(seq)
    const event = log[seq]
    if (!event || Number(event.seq) !== seq) return
    if (isCompactedStoryEvent(event)) {
      if (event.data?.source?.plugin === 'roleplay-context-window') {
        const archived = Array.isArray(event.sourceEventSeqs) ? event.sourceEventSeqs : []
        for (const source of archived) expand(source, depth + 1)
        return
      }
      const id = String(event.data?.source?.compactionId ?? '')
      const summary = summaries.get(id)
      if (!id || !ended.has(id) || !summary || summary.seq >= seq) return
      const archived = summary.data?.shadowedSeqs
      if (!Array.isArray(archived) || archived.some((source) => durableSeq(source) === null || source >= seq)) return
      for (const source of archived) expand(source, depth + 1)
    } else expanded.push(seq)
  }
  for (const seq of surface) expand(seq)
  return expanded
}

export function selectedStoryHistory(session) {
  const log = eventsOf(session)
  const surface = surfaceSeqsOf(session), surfaceKey = surface.join(',')
  // Native snapshots are immutable and replaced on every append. Cache only
  // that contract, never mutable legacy/mock logs; selection is a separate key.
  const cached = selectedStoryCache.get(session)
  if (cached?.log === log && cached.id === session.id && cached.surfaceKey === surfaceKey) return cached.rows.map(row => ({ ...row }))
  // Token chunks contribute only immutable type/seq, not their payload. Story
  // evidence payloads must also be deeply immutable, including legacy callers.
  const cacheable = Object.isFrozen(log) && log.every(event => Object.isFrozen(event) &&
    (!storyDataTypes.has(event?.type) || immutableStoryValue(event)))
  const management = importManagementInputs(session)
  const expanded = expandedHistorySeqs(session)
  const canonical = canonicalAssistantSeqsOf(session, expanded)
  const completed = new Set(log.filter(isCompletedTurnEnd).map((event) => Number(event.data?.turn)))
  const afterStory = afterStoryProofs(session, new Set(expanded))
  const turnBySeq = new Map()
  let turn = null
  for (const event of log) {
    if (event?.type === 'turn/start') turn = Number(event.data?.turn)
    if (event) turnBySeq.set(event.seq, turn)
    if (event?.type === 'turn/end') turn = null
  }
  const originalTurn = (event, seen = new Set()) => {
    if (!event || seen.has(event.seq)) return null
    seen.add(event.seq)
    const direct = Number.isSafeInteger(event.data?.turn) ? event.data.turn : turnBySeq.get(event.seq)
    if (direct !== null && direct !== undefined) return direct
    if (event.surfaceOp?.op === 'replace') return originalTurn(log[event.surfaceOp.start], seen)
    return null
  }
  const rows = expanded.map((seq) => log[seq]).filter((event) => {
    if (!isStoryEvent(event, canonical, management)) return false
    return completed.has(originalTurn(event)) || afterStory.turns.has(originalTurn(event))
  }).map((event) => ({
    id: `${session.id}:${event.seq}`,
    seq: event.seq,
    turn: originalTurn(event),
    role: event.type === 'user/message' ? 'user' : 'assistant',
    messageId: event.data?.message?.id ?? event.data?.id ?? null,
    text: textOf(contentOfEvent(event)),
    time: event.time ?? null,
  }))
  if (cacheable) selectedStoryCache.set(session, { log, id: session.id, surfaceKey, rows: rows.map(row => ({ ...row })) })
  return rows
}

function queryHistoryRows(session, scope) {
  if (scope === 'story' || scope === undefined) return selectedStoryHistory(session)
  if (scope !== 'tools') throw new Error('历史查询范围无效')
  const log = eventsOf(session)
  return expandedHistorySeqs(session).map(seq => log[seq]).flatMap(event => {
    let content
    if (event.type === 'tool/result') content = event.data?.message?.content ?? event.data?.content
    else if (event.type === 'assistant/message') content = event.data?.message?.content?.filter(block => block.type === 'tool-call')
    else return []
    if (!content?.length) return []
    return [{id:`${session.id}:${event.seq}`,seq:event.seq,role:'tool',eventType:event.type,
      text:JSON.stringify(content),time:event.time??null}]
  })
}

/** Bounded history results use source seq cursors, not the full transcript as prompt. */
export function queryStoryHistory(session, { query = '', beforeSeq, limit = 12, maxChars = 12000, scope = 'story' } = {}) {
  const cap = Math.max(1, Math.min(100, Number(limit) || 12))
  const budget = Math.max(256, Math.min(60000, Number(maxChars) || 12000))
  const all = queryHistoryRows(session, scope)
  const before = durableSeq(beforeSeq)
  const end = before === null ? all.length : all.findIndex((entry) => entry.seq === before)
  if (end < 0) throw new Error('历史游标不属于当前选中分支')
  const terms = String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const candidates = all.slice(0, end).filter((entry) => terms.every((term) => entry.text.toLocaleLowerCase().includes(term)))
  const results = []
  let used = 0
  for (const entry of candidates.toReversed()) {
    if (results.length >= cap || used >= budget) break
    const remaining = budget - used
    const position = terms.length ? Math.max(0, entry.text.toLocaleLowerCase().indexOf(terms[0]) - 240) : 0
    const available = entry.text.slice(position, position + remaining)
    results.push({ ...entry, text: available, textOffset: position, truncated: position > 0 || available.length < entry.text.length })
    used += available.length
  }
  results.reverse()
  return { sessionId: session.id, totalEntries: all.length, matchedEntries: candidates.length, entries: results,
    nextBeforeSeq: candidates.length > results.length ? results[0]?.seq ?? null : null }
}

export function readStoryHistory(session, { seq, offset = 0, maxChars = 12000, scope = 'story' } = {}) {
  const entry = queryHistoryRows(session, scope).find((entry) => entry.seq === durableSeq(seq))
  if (!entry) throw new Error('历史条目不属于当前选中分支')
  const start = Math.max(0, Math.min(entry.text.length, Number.isSafeInteger(offset) ? offset : 0))
  const budget = Math.max(256, Math.min(60000, Number(maxChars) || 12000))
  const end = Math.min(entry.text.length, start + budget)
  return { ...entry, text: entry.text.slice(start, end), textOffset: start, totalChars: entry.text.length,
    nextOffset: end < entry.text.length ? end : null }
}

function historySourceKeys(entries) {
  return entries.map((entry) => `${entry.seq}:${createHash('sha256').update(`${entry.role}\n${entry.text}`).digest('hex')}`)
}

export function storyCadenceSlots(entries) {
  const anchors = new Map()
  for (const entry of entries) {
    if (entry.role !== 'user' || !Number.isFinite(entry.turn) || anchors.has(entry.turn)) continue
    anchors.set(entry.turn, entry.seq)
  }
  const seen = new Set(), slots = []
  for (const entry of entries) {
    if (entry.role !== 'assistant' || !Number.isFinite(entry.turn) || seen.has(entry.turn)) continue
    seen.add(entry.turn)
    slots.push({ turn: entry.turn, anchorSeq: anchors.get(entry.turn) ?? entry.seq })
  }
  return slots
}

export function legacyCadenceSlots(entries, record) {
  const candidates = [record?.directorNotes, ...(Array.isArray(record?.directorCheckpoints) ? record.directorCheckpoints : [])]
  const coveredEntries = Math.min(entries.length, Math.max(0, ...candidates.map(note => Array.isArray(note?.sourceKeys) ? note.sourceKeys.length : 0)))
  return storyCadenceSlots(entries.slice(0, coveredEntries))
}

/** Count canonical story slots, not physical agent turns or regenerated versions. */
export function memoryNotesCadence(session, record, everyTurns = 3) {
  const entries = selectedStoryHistory(session)
  const notes = directorNotesForBranch(record, session, entries)
  const slots = storyCadenceSlots(entries)
  const storedSlots = record?.notesCadence?.schemaVersion === 1 && Array.isArray(record.notesCadence.slots)
    ? record.notesCadence.slots
    : legacyCadenceSlots(entries, record)
  let coveredTurns = 0
  while (coveredTurns < slots.length && coveredTurns < storedSlots.length
    && Number(slots[coveredTurns].turn) === Number(storedSlots[coveredTurns]?.turn)) coveredTurns += 1
  const validCoveredTurns = storyCadenceSlots(entries.slice(0, notes?.sourceKeys.length ?? 0)).length
  const completedTurns = slots.length
  const pendingTurns = Math.max(0, completedTurns - coveredTurns)
  const previous = record?.directorNotes
  const rebuildRequired = Boolean(previous?.sourceKeys?.length && previous !== undefined &&
    (!notes || notes.sourceKeys.length < previous.sourceKeys.length))
  const interval = Number.isSafeInteger(everyTurns) && everyTurns > 0 ? everyTurns : 3
  return {schemaVersion:1, branchId:session.id, completedTurns, coveredTurns, pendingTurns,
    validCoveredTurns, rebuildRequired, due:pendingTurns >= interval}
}

/** Exact content provenance rejects stale notes after edits or sibling switches. */
export function directorNotesForBranch(record, session, entries = selectedStoryHistory(session)) {
  const actual=historySourceKeys(entries)
  const matches=notes=>notes&&typeof notes.text==='string'&&notes.text.trim()&&Array.isArray(notes.sourceKeys)
    &&notes.sourceKeys.length>0&&notes.sourceKeys.length<=actual.length
    &&notes.sourceKeys.every((key,index)=>key===actual[index])
  // User-edited/current notes remain authoritative when their exact prefix is
  // valid. A fork may discard only their tail: recover a validated saved prefix
  // rather than paying to rewrite all prior notes. No sibling content is used.
  let notes=matches(record?.directorNotes)?record.directorNotes:null
  if(!notes)notes=(Array.isArray(record?.directorCheckpoints)?record.directorCheckpoints:[])
    .filter(candidate=>candidate?.validated===true&&matches(candidate))
    .sort((a,b)=>b.sourceKeys.length-a.sourceKeys.length)[0]
  return notes?{...notes,pendingEntries:entries.length-notes.sourceKeys.length}:null
}

function isCompactedStoryEvent(event) {
  return event?.type === 'user/message'
    && event?.data?.source?.kind === 'plugin'
    && (event?.data?.source?.plugin === 'compact' || event?.data?.source?.plugin === 'roleplay-context-window')
}

function errorText(error) {
  if (error instanceof Error) return error.stack || error.message
  return String(error)
}

function abortable(promise, signal) {
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error('操作已取消'))
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error('操作已取消'))
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

function validateDetailedSummary(summary, sourceText, lockedFacts) {
  const text = String(summary ?? '').trim()
  for (let section = 1; section <= 8; section += 1) {
    const heading = new RegExp(`(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?${section}[.、．]\\s*`, 'm')
    if (!heading.test(text)) throw new Error(`记忆摘要缺少第 ${section} 段，未提交不完整结果`)
  }
  for (const raw of lockedFacts) {
    const fact = typeof raw === 'string' ? raw : String(raw?.text ?? '')
    if (fact && !text.includes(fact)) {
      throw new Error(`记忆摘要遗漏用户锁定事实，未提交：${fact.slice(0, 120)}`)
    }
  }
  if (String(sourceText ?? '').length >= 20000) {
    const minimumChars = Math.min(12000, Math.floor(String(sourceText).length * 0.05))
    if (text.length < minimumChars) {
      throw new Error(`记忆摘要过度压缩（${text.length} < ${minimumChars} 字符），未提交低保真结果`)
    }
  }
}

function checkpointSummaryFromSurface(session) {
  const events = eventsOf(session)
  const visible = new Set(surfaceSeqsOf(session))
  let text = ''
  let seq = -1
  for (const event of events) {
    if (!visible.has(Number(event?.seq)) || !isCompactedStoryEvent(event)) continue
    const raw = textOf(contentOfEvent(event))
    const match = raw.match(/<compacted-summary>\s*([\s\S]*?)\s*<\/compacted-summary>/i)
    text = (match?.[1] ?? raw).trim()
    seq = Number(event.seq)
  }
  return text ? { text, seq } : null
}

export function durableCompactionArchives(session) {
  const events = eventsOf(session)
  // The append-only log contains compactions from discarded branches too.
  // A summary/checkpoint pair is durable only when its replacement checkpoint
  // is currently visible on this session surface.  Looking at the log alone
  // would re-introduce a sibling's future archive when a child is lazy-loaded.
  const visible = new Set(surfaceSeqsOf(session))
  const ended = new Set(events
    .filter((event) => event?.type === 'compaction/end' && !event.data?.error)
    .map((event) => String(event.data?.compactionId ?? '')))
  const archives = []
  for (const summaryEvent of events) {
    if (summaryEvent?.type !== 'compaction/summary') continue
    const compactionId = String(summaryEvent.data?.compactionId ?? '')
    if (!compactionId || !ended.has(compactionId)) continue
    const summarySeq = durableSeq(summaryEvent.seq)
    if (summarySeq === null) continue
    const checkpoint = events[summarySeq + 1]
    const checkpointSeq = durableSeq(checkpoint?.seq)
    if (checkpoint?.type !== 'user/message' ||
      checkpoint.data?.source?.kind !== 'plugin' ||
      checkpoint.data?.source?.plugin !== 'compact' ||
      String(checkpoint.data?.source?.compactionId ?? '') !== compactionId ||
      checkpoint.surfaceOp?.op !== 'replace' ||
      checkpointSeq === null ||
      !visible.has(checkpointSeq)) continue
    archives.push({
      compactionId,
      sessionId: session.id,
      range: summaryEvent.data.shadowedRange,
      seqs: summaryEvent.data.shadowedSeqs,
      atSeq: summarySeq,
      checkpointSeq,
      recoveredFromLog: true,
    })
  }
  return archives
}

function inspectCompactionState(session) {
  let openTurn = null
  let openTurnKnown = false
  let unmatchedStart = null
  let compactionKnown = false
  let latestEndSeedSeq
  const events = eventsOf(session)
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (latestEndSeedSeq === undefined && event?.type === 'session/end-seed') {
      latestEndSeedSeq = Number(event.seq)
    }
    if (!compactionKnown) {
      if (event?.type === 'compaction/start') {
        unmatchedStart = event
        compactionKnown = true
      } else if (event?.type === 'compaction/end') {
        compactionKnown = true
      }
    }
    if (!openTurnKnown) {
      if (event?.type === 'turn/start') {
        openTurn = Number(event.data?.turn)
        openTurnKnown = true
      } else if (event?.type === 'turn/end') {
        openTurnKnown = true
      }
    }
    if (openTurnKnown && compactionKnown && latestEndSeedSeq !== undefined) break
  }
  const active = unmatchedStart !== null &&
    !(latestEndSeedSeq !== undefined && latestEndSeedSeq > Number(unmatchedStart.seq))
  return { openTurn, unmatchedStart: active ? unmatchedStart : null }
}

export async function apply(ctx, config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...(config ?? {}) }
  const busy = new Set() // sessionId → in-flight 压缩
  const notesBusy = new Set()
  const activeNotes = new Map()
  const activeCompactions = new Map()
  const notesGeneration = new Map()
  const automaticNotes = new Map()
  const automaticCompaction = new Map()
  const noteWrites = new Map()
  let disposed = false
  // roleplay/commands 都可能比本插件晚挂载或热重载；禁止缓存服务实例。
  const getEngine = () => ctx.get('roleplay')
  const assertBranchActive = (session) => {
    if (getEngine()?.isStoryBranchActive?.(session) !== false) return
    const error = new Error('当前剧情分支已删除；未提交后台记忆结果')
    error.code = 'ROLEPLAY_SOURCE_CHANGED'
    throw error
  }

  async function writeNotes(sessionId, action) {
    const previous = noteWrites.get(sessionId) ?? Promise.resolve()
    const current = previous.catch(() => {}).then(action)
    noteWrites.set(sessionId, current)
    try { return await current }
    finally { if (noteWrites.get(sessionId) === current) noteWrites.delete(sessionId) }
  }

  function backoff(state, error) {
    state.failures = (state.failures ?? 0) + 1
    const base = Math.max(1000, Number(cfg.autoRetryBaseMs) || 30000)
    const maximum = Math.max(base, Number(cfg.autoRetryMaxMs) || 300000)
    state.retryAt = Date.now() + Math.min(maximum, base * 2 ** Math.min(10, state.failures - 1))
    state.error = String(error?.message ?? error)
  }

  if (typeof ctx.effect === 'function') ctx.effect(() => () => {
    disposed = true
    for (const state of automaticNotes.values()) {
      clearTimeout(state.timer)
      state.controller?.abort(new Error('记忆插件已卸载'))
    }
  }, 'roleplay-memory: background notes')

  const isRoleplaySession = (session) => {
    if (!session) return false
    if(eventsOf(session).some(e=>e?.type==='subagent/descriptor'&&Number(e.seq)>=Number(session.header?.seedLength??0)))return false
    let preset = session.header?.agentPreset
    for (const e of eventsOf(session)) {
      if (e && e.type === 'agent-preset/selected' && e.data?.agentPreset) preset = e.data.agentPreset
    }
    return preset === 'roleplay'
  }

  // ── 分支感知：只计算当前 Session surface，而不是 append-only log ────────
  // fork 的 seed 前缀仍是当前分支真实上下文，必须计入阈值；否则从一个已经
  // 很长但尚未压缩的父分支 fork 后，会在超出模型窗口很久以后才触发整理。
  // 已压缩原文在 surface 中已被 summary 替换，因此不会被重复归档。

  function branchSettings(session) {
    try {
      return getEngine()?.settings?.(session.id) ?? null
    } catch {
      return null
    }
  }

  function memoryForSession(session) {
    const engine = getEngine()
    const storedRecord = engine?.memoryHead?.(session.id) ?? null
    const checkpoint = checkpointSummaryFromSurface(session)
    const projected = filterMemoryRecordForBranch(storedRecord, session, checkpoint)
    if (!projected) return null

    // Recover only completed compactions whose replacement checkpoint is on
    // this exact surface.  The in-memory head may lag the append-only log, but
    // it must never be allowed to reintroduce a discarded sibling's archive.
    const scope = branchScope(session)
    const durableArchives = durableCompactionArchives(session)
      .filter((item) => belongsToBranch(item, session, scope))
    const storedArchives = projected.archives
    const seen = new Set(durableArchives.map((item) => item.compactionId || `seq:${item.atSeq}`))
    const archives = [
      ...storedArchives.filter((item) => !seen.has(item?.compactionId || `seq:${item?.atSeq}`)),
      ...durableArchives,
    ].slice(-50)
    return {
      ...projected,
      archives,
      directorNotes: directorNotesForBranch(projected, session),
    }
  }

  function storySurface(session, measurement) {
    const log = eventsOf(session)
    const management = importManagementInputs(session)
    const surfaceSeqs = surfaceSeqsOf(session)
    const canonicalAssistantSeqs = canonicalAssistantSeqsOf(session)
    const measured = Array.isArray(measurement?.nodes) ? measurement.nodes : []
    if (surfaceSeqs.length !== measured.length || surfaceSeqs.some((seq, index) => seq !== measured[index]?.seq)) {
      throw new Error('roleplay-memory: token meter 与当前会话 surface 不一致')
    }
    return surfaceSeqs.map((seq, position) => {
      const event = log[seq]
      return {
        seq,
        position,
        event,
        measurement: measured[position],
        story: isStoryEvent(event, canonicalAssistantSeqs, management),
        // 已归档摘要仍占模型上下文，因此参与阈值计算；但它不是新的剧情
        // 原文，绝不再次送入摘要器或作为可归档范围的起点。
        context: isStoryEvent(event, canonicalAssistantSeqs, management) || isCompactedStoryEvent(event),
      }
    })
  }

  function branchTokens(session, measurement) {
    return storySurface(session, measurement)
      .filter((node) => node.context)
      .reduce((total, node) => total + (Number(node.measurement?.tokens) || Number(node.measurement?.heuristicTokens) || 0), 0)
  }

  function pressureTokens(session, measurement) {
    // Trigger from the complete routed request pressure so a large immutable
    // card/worldbook cannot silently consume the model window. Selection and
    // summarization below remain plot-only.
    return Math.max(Number(measurement?.totalTokens) || 0, branchTokens(session, measurement))
  }

  // ── 选择待归档区间（头锚定，仅本分支活区）─────────────────────────────────

  function selectArchiveRange(session, { force = false } = {}) {
    let measurement
    try {
      measurement = ctx.tokenMeter.measure(session)
    } catch (error) {
      throw new Error(`无法计量当前分支上下文，未修改会话：${String(error?.message ?? error)}`, { cause: error })
    }
    const surface = storySurface(session, measurement)
    const storyNodes = surface.filter((node) => node.story)
    if (storyNodes.length === 0) return null
    const settings = branchSettings(session)
    const target = Number(settings?.targetContextTokens) || Number(cfg.targetContextTokens) || 262144
    const hysteresis = Math.max(0, Number(settings?.hysteresisTokens ?? cfg.hysteresisTokens) || 0)
    const triggerAt = Math.max(1, target - Math.min(target - 1, hysteresis))
    const total = pressureTokens(session, measurement)
    if (!force && total < triggerAt) return null

    const archiveTarget = Number(settings?.archiveTokens) || Number(cfg.archiveTokens) || 100000
    const rawStoryTokens = storyNodes.reduce((sum, node) =>
      sum + (Number(node.measurement?.tokens) || Number(node.measurement?.heuristicTokens) || 0), 0)
    // 正常情况下每次最多归档 archiveTokens，并保留其余最新剧情；当角色卡/
    // 世界书等不可压缩前缀很大、导致完整请求提前触线时，允许剧情保留量自适应
    // 降到 target 的 1/4（但仍不摘要那些前缀）。否则“完整压力触发”会因固定的
    // target-archive 保留线而永远选不出范围。
    const emergencyTail = Math.min(archiveTarget, Math.floor(target / 4), Math.floor(rawStoryTokens / 4))
    const retainFloor = Math.min(rawStoryTokens, Math.max(emergencyTail, rawStoryTokens - archiveTarget))
    const log = eventsOf(session)
    const completedTurns = new Set(
      log.filter(isCompletedTurnEnd).map((event) => Number(event.data?.turn)),
    )
    const lastSurfacePositionByTurn = new Map()
    for (const node of surface) {
      const turn = Number(node.event?.data?.turn)
      if (Number.isFinite(turn)) lastSurfacePositionByTurn.set(turn, node.position)
    }

    // 一个归档单元从真实用户剧情输入开始，在已落盘 turn/end 的最后一条
    // assistant 正文结束；不能从半轮开始，也不能吞掉仍在生成的尾轮。
    // An imported opening remains plot even when its preceding user message
    // is a configuration/import command, not a fictional player action.
    const firstStory = storyNodes[0]
    if (!firstStory) return null
    // 后续整理必须同时替换之前的 compacted-summary；新摘要已经合并了
    // previousSummary，若把旧摘要留在 surface，会重复占上下文并让模型看到
    // 两份不同代际的记忆。只把位于首段待归档剧情之前的 context 节点纳入。
    const first = surface.find((node) => node.context && node.position <= firstStory.position) ?? firstStory
    let storyAcc = 0
    let endPosition = -1
    for (let position = first.position; position < surface.length; position += 1) {
      const node = surface[position]
      if (node.story) storyAcc += Number(node.measurement?.tokens) || Number(node.measurement?.heuristicTokens) || 0
      const turn = Number(node.event?.data?.turn)
      const completeBoundary = Number.isFinite(turn)
        && completedTurns.has(turn)
        && lastSurfacePositionByTurn.get(turn) === position
      if (!completeBoundary) continue
      if (rawStoryTokens - storyAcc < retainFloor) {
        // Turns are indivisible. Permit the first complete turn to overshoot
        // archiveTokens when doing so still leaves the emergency recent tail.
        if (endPosition < first.position && rawStoryTokens - storyAcc >= emergencyTail) {
          endPosition = position
        }
        break
      }
      endPosition = position
      if (storyAcc >= archiveTarget) break
    }
    if (endPosition < first.position) return null
    const selected = surface.slice(first.position, endPosition + 1)
    const shadowedSeqs = selected.map((node) => node.seq)
    const storySeqs = selected.filter((node) => node.story).map((node) => node.seq)
    return {
      // start/end 是 surface 位置的首尾；替换后的 seq 可以非单调，绝不数值排序。
      start: shadowedSeqs[0],
      end: shadowedSeqs.at(-1),
      startPosition: first.position,
      endPosition,
      shadowedSeqs,
      storySeqs,
      shadowedTokenCount: selected.reduce((sum, node) => sum + (Number(node.measurement?.heuristicTokens) || 0), 0),
      routeTokenCount: selected.reduce((sum, node) => sum + (Number(node.measurement?.tokens) || Number(node.measurement?.heuristicTokens) || 0), 0),
      storyTokenCount: selected.filter((node) => node.story).reduce((sum, node) => sum + (Number(node.measurement?.tokens) || Number(node.measurement?.heuristicTokens) || 0), 0),
      totalTokens: total,
    }
  }

  // ── 单次压缩 ──────────────────────────────────────────────────────────────

  function storyTextForSeqs(session, seqs) {
    const log = eventsOf(session)
    return seqs.map((seq) => {
      const event = log[seq]
      if (!isStoryEvent(event)) return ''
      const role = event.type === 'user/message' ? '用户' : '叙事者'
      return `\n[${role} · seq:${seq}]\n${textOf(contentOfEvent(event))}`
    }).filter(Boolean).join('\n')
  }

  function assertSelectedSurfaceStable(session, range) {
    const nodes = surfaceSeqsOf(session)
    const startPosition = nodes.indexOf(range.start)
    if (startPosition < 0) throw new Error('整理期间归档区间起点已离开当前分支')
    const current = nodes.slice(startPosition, startPosition + range.shadowedSeqs.length)
    if (current.length !== range.shadowedSeqs.length
      || current.some((seq, index) => seq !== range.shadowedSeqs[index])) {
      throw new Error('整理期间当前分支的归档区间发生变化，请重试')
    }
  }

  async function summarizeDetailed({ session, previousSummary, sourceText, lockedText, maxTokens, timeoutMs, signal, taskStage='notes', appendDelta=false, background=false, sourceSeqs }) {
    // A native task may span several loop steps. Its checkpoint and sources
    // remain durable; do not mislabel it as a direct llm.stream replay.
    return summarize(ctx, {
      session,
      system: SUMMARY_SYSTEM + (background
        ? '\n本次将导演笔记、正史增量与连续性核对合并为一个后台任务。仅返回 JSON 对象：{"text":"完整八段 Markdown 笔记","deltas":[{"evidenceSeq":原文seq,"summary":"已发生事实","status":"established或uncertain"}],"conflicts":[{"evidenceSeq":原文seq,"claim":"新说法","canon":"既有记录","severity":"low或medium或high"}]}。text 保留完整细节；deltas 只列新增事实，conflicts 只列有来源支持的矛盾，不把未知情况当冲突。没有增量或冲突时对应数组为空。'
        : '') + (appendDelta
        ? '\n本任务是导演笔记的追加更新：仅输出本次新增或更正，不重写既有笔记。仍按八段输出，只填新增信息，无变化的段落写「无」。既有笔记由后端逐字保留；锁定事实也由后端保留，不需重复输出。状态变化必须说明原状态、现状态与发生顺序；明确更正必须指出被纠正的旧说法及新证据。保留新增剧情全部条件、细节和台词，不以简短为目标。不要删除、概括或重新抄写旧事件。'
        : ''),
      user: (appendDelta
        ? '请根据既有笔记核对本次新增剧情，只返回本次追加记录。后端按来源顺序追加，最新有证据的更正与状态变化优先于旧快照；旧事实并不因此全部失效。'
        :
        '请把「既有剧情记忆」与「本次新增的连续剧情原文」做增量合并。既有条目除非被新原文明确纠正，否则不得删除；新原文中的独有细节必须逐项加入。' +
        '\n不要续写，不要把后台材料当剧情，不要为了变短而合并不同事件。') +
        `\n\n## 既有剧情记忆\n${previousSummary || '（首次整理）'}` +
        `\n\n## 本次新增剧情原文\n${sourceText}` +
        `\n\n## 用户显式锁定的剧情事实（逐字保留）\n${lockedText || '（无）'}`,
      maxTokens,
      timeoutMs,
      signal,
      taskStage,
      background,
      sourceSeqs,
      validate:text=>{validateDetailedSummary(text,sourceText,!appendDelta&&lockedText?[lockedText]:[]);return text},
    })
  }

  function refreshDirectorNotes(session, ...args) {
    if (activeNotes.has(session.id)) return Promise.reject(new Error('导演笔记整理正在进行中，请稍后再试'))
    const job = performDirectorNotes(session, ...args).finally(() => {
      if (activeNotes.get(session.id) === job) activeNotes.delete(session.id)
    })
    activeNotes.set(session.id, job)
    return job
  }

  async function performDirectorNotes(session, agent, signal, commandId, { automatic = false, force = false, background = false } = {}) {
    if (notesBusy.has(session.id)) throw new Error('导演笔记整理正在进行中，请稍后再试')
    notesBusy.add(session.id)
    const generation = notesGeneration.get(session.id) ?? 0
    try {
      const engine = getEngine()
      if (typeof engine?.memoryUpdate !== 'function') throw new Error('roleplay 核心未就绪')
      if (typeof engine.awaitCommitted === 'function') await engine.awaitCommitted(session.id)
      signal?.throwIfAborted?.()
      if (!automatic && inspectCompactionState(session).openTurn !== null) throw new Error('导演笔记整理只能在 agent 空闲时执行')
      const entries = selectedStoryHistory(session)
      assertBranchActive(session)
      if (entries.length === 0) return { kind: 'notes', changed: false, entries: 0, reason: 'no-completed-story' }
      const originalKeys = historySourceKeys(entries)
      const stored = engine.memoryHead?.(session.id) ?? {}
      const existing = directorNotesForBranch(stored, session, entries)
      let processed = force ? 0 : (existing?.sourceKeys.length ?? 0)
      if (!force && processed === entries.length) return { kind: 'notes', changed: false, entries: processed, reason: 'up-to-date' }
      let previous = force ? '' : (existing?.text ?? '')
      const settings = branchSettings(session)
      const batchChars = Math.max(10000, Number(settings?.notesBatchChars ?? cfg.notesBatchChars) || 100000)
      const maxTokens = Math.max(1024, Number(settings?.maxSummaryTokens ?? cfg.maxSummaryTokens) || 16384)
      const timeoutMs = automatic
        ? Math.max(1000, Number(settings?.autoNotesTimeoutMs ?? cfg.autoNotesTimeoutMs) || 300000)
        : Math.max(30000, Number(settings?.summaryTimeoutMs ?? cfg.summaryTimeoutMs) || 300000)
      const locked = Array.isArray(stored.lockedFacts) ? scopedLedgerItems(stored.lockedFacts, session) : []
      const lockedText = locked.map((fact) => typeof fact === 'string' ? fact : String(fact?.text ?? '')).filter(Boolean).join('\n')
      let batches = 0
      while (processed < entries.length) {
        signal?.throwIfAborted?.()
        const batch = []
        let chars = 0
        while (processed + batch.length < entries.length) {
          const entry = entries[processed + batch.length]
          if (batch.length && batch.at(-1).turn !== entry.turn && chars + entry.text.length > batchChars) break
          batch.push(entry)
          chars += entry.text.length
        }
        const sourceText = batch.map((entry) => `[${entry.role === 'user' ? '用户' : '叙事者'} · turn:${entry.turn} · seq:${entry.seq}]\n${entry.text}`).join('\n\n')
        const appendDelta = Boolean(previous) && !force
        const updateStart = processed
        const result = await summarizeDetailed({ session, previousSummary: previous, sourceText, lockedText, maxTokens, timeoutMs, signal, appendDelta,
          background, sourceSeqs:batch.map(entry=>entry.seq),taskStage:background?'background-notes':'notes' })
        validateDetailedSummary(result.text, sourceText, appendDelta ? [] : locked)
        signal?.throwIfAborted?.()
        if ((notesGeneration.get(session.id) ?? 0) !== generation) throw new Error('导演笔记已由用户修改，后台结果未覆盖用户编辑')
        processed += batch.length
        // The model handles new evidence and explicit corrections only. Preserve
        // the verified prefix verbatim; never pay for a complete rewrite on each
        // story turn. Full consolidation remains the compaction path.
        previous = appendDelta
          ? `${previous}\n\n## 剧情更新 · seq:${batch[0].seq}–${batch.at(-1).seq}\n最新有证据的更正与状态变化优先于旧快照；未被更正的旧事实继续有效。\n\n${result.text}`
          : result.text
        for (const fact of locked) {
          const value = typeof fact === 'string' ? fact : String(fact?.text ?? '')
          if (value && !previous.includes(value)) previous += `\n\n用户锁定事实：\n${value}`
        }
        batches += 1
        const checkpoint = {
            schemaVersion: 1, generationId: randomUUID(), branchId: session.id,
            projectionMode: appendDelta ? 'append-delta' : 'full', updateSourceKeys: originalKeys.slice(updateStart, processed),
            text: previous, sourceKeys: originalKeys.slice(0, processed), sourceSeqs: entries.slice(0, processed).map((entry) => entry.seq),
            sessionId: session.id, sourceEntryCount: processed, throughSeq: entries[processed - 1].seq,
            updatedAt: Date.now(), commandId: commandId ?? null, validated: true,
        }
        await writeNotes(session.id, async () => {
          assertBranchActive(session)
          if ((notesGeneration.get(session.id) ?? 0) !== generation) throw new Error('导演笔记已由用户修改，后台结果未覆盖用户编辑')
          const currentKeys = historySourceKeys(selectedStoryHistory(session))
          if (originalKeys.some((key,index)=>currentKeys[index]!==key))throw new Error('整理期间当前分支剧情已变更；未保存过期笔记')
          const head = engine.memoryHead?.(session.id) ?? {}
          const previousCheckpoints = Array.isArray(head.directorCheckpoints) ? head.directorCheckpoints : []
          const decorate=item=>{
            const index=entries.findIndex(entry=>entry.seq===item.evidenceSeq)
            return {...item,schemaVersion:1,sessionId:session.id,atSeq:item.evidenceSeq,
              turnId:entries[index].turn,batchThroughSeq:checkpoint.throughSeq,
              sourceGeneration:checkpoint.generationId,sourceKey:originalKeys[index]}
          }
          const merge=(prior,incoming)=>{
            const values=Array.isArray(prior)?prior:[]
            return [...values,...incoming.map(decorate).filter(item=>!values.some(old=>old.sourceKey===item.sourceKey&&
              old.summary===item.summary&&old.claim===item.claim&&old.canon===item.canon))]
          }
          await engine.memoryUpdate(session.id, {
            directorNotes: checkpoint,
            directorCheckpoints: [...previousCheckpoints.filter((item) => item.throughSeq !== checkpoint.throughSeq), checkpoint].slice(-32),
            notesCadence: { schemaVersion: 1, branchId: session.id, slots: storyCadenceSlots(entries),
              updatedAt: Date.now(), throughSeq: checkpoint.throughSeq },
            ...(background?{
              deltas:merge(head.deltas,result.deltas??[]),
              pendingConfirmations:merge(head.pendingConfirmations,result.conflicts??[]),
              version:(Number(head.version)||1)+1,updatedAtSeq:checkpoint.throughSeq,
            }:{}),
          })
        })
      }
      return { kind: 'notes', changed: true, entries: processed, batches, chars: previous.length }
    } finally {
      notesBusy.delete(session.id)
    }
  }

  function reusableSummary(session, range, mem, sourceText, locked) {
    if (mem.directorNotes?.manual === true) return null
    const history = selectedStoryHistory({ id: session.id, header: session.header, events: eventsOf(session), surface: { nodes: range.shadowedSeqs } })
    const expected = historySourceKeys(history)
    if (!expected.length) return null
    const candidates = [mem.directorNotes, ...(Array.isArray(mem.directorCheckpoints) ? mem.directorCheckpoints.toReversed() : [])]
    for (const candidate of candidates) {
      if (candidate?.validated !== true || candidate.manual === true || !Array.isArray(candidate.sourceKeys)) continue
      if (candidate.sourceKeys.length !== expected.length || expected.some((key, index) => candidate.sourceKeys[index] !== key)) continue
      try { validateDetailedSummary(candidate.text, sourceText, locked) } catch { continue }
      return { text: candidate.text, summary: [{ type: 'text', text: candidate.text }], reused: true }
    }
    return null
  }

  function compact(session, ...args) {
    if (activeCompactions.has(session.id)) return Promise.reject(new Error('记忆整理正在进行中，请稍后再试'))
    const job = performCompaction(session, ...args).finally(() => {
      if (activeCompactions.get(session.id) === job) activeCompactions.delete(session.id)
    })
    activeCompactions.set(session.id, job)
    return job
  }

  async function performCompaction(session, agent, signal, sourceCommandId, { force = false, manual = false } = {}) {
    assertBranchActive(session)
    if (busy.has(session.id)) throw new Error('记忆整理正在进行中，请稍后再试')
    signal?.throwIfAborted?.()
    busy.add(session.id)
    let startEvent = null
    let lifecycle = null
    let closed = false
    try {
      const engine = getEngine()
      if (!engine || typeof engine.memoryHead !== 'function') throw new Error('roleplay 核心未就绪')
      // Phase B commits memory/scene asynchronously after the agent becomes
      // idle. A host exposing this barrier lets compaction serialize against
      // that writer instead of racing its read-modify-write memoryUpdate.
      if (typeof engine.awaitCommitted === 'function') await engine.awaitCommitted(session.id)
      signal?.throwIfAborted?.()
      const range = selectArchiveRange(session, { force })
      if (!range) return null

      const entryState = inspectCompactionState(session)
      if (entryState.unmatchedStart) {
        throw new Error(`会话已有未闭合的记忆整理事务：${entryState.unmatchedStart.data?.compactionId ?? entryState.unmatchedStart.seq}`)
      }
      if (manual && entryState.openTurn !== null) throw new Error('手动记忆整理只能在 agent 空闲时执行')
      if (!manual && entryState.openTurn === null) throw new Error('自动记忆整理必须位于一个已开启的 turn 内')

      // 只读取当前 surface 中本次选中的真实 user/assistant 剧情；工具结果、
      // 未选分支、角色卡/世界书存储与插件检查点不进入剧情摘要。
      const sourceText = storyTextForSeqs(session, range.storySeqs)
      if (!sourceText.trim()) throw new Error('归档区间没有可用原文')
      const mem = memoryForSession(session) ?? {}
      // lockedFacts() 会把角色卡/世界书也聚合进来；记忆压缩不得复制这些
      // 独立材料，只保留用户在记忆账本中显式锁定的剧情事实。
      const locked = Array.isArray(mem.lockedFacts) ? mem.lockedFacts : []
      const lockedText = locked.length
        ? locked.map((f) => typeof f === 'string' ? f : String(f?.text ?? '')).filter(Boolean).join('\n')
        : '（无）'
      const prevSummary = mem.summary ?? '（首次整理）'

      // 先落盘 start 作为锁，再进行可能耗时的高保真增量摘要。
      // start 之后的任何失败都必须恰好尝试一次 end(error)。
      const compactionId = randomUUID()
      lifecycle = {
        compactionId,
        ...(sourceCommandId === undefined ? {} : { sourceCommandId }),
        turn: manual ? null : entryState.openTurn,
      }
      startEvent = session.append('compaction/start', lifecycle)

      const settings = branchSettings(session)
      const maxTokens = Math.max(1, Number(settings?.maxSummaryTokens ?? cfg.maxSummaryTokens) || 16384)
      const timeoutMs = manual
        ? Math.max(30000, Number(settings?.summaryTimeoutMs ?? cfg.summaryTimeoutMs) || 300000)
        : Math.max(1000, Math.min(60000, Number(cfg.autoTimeoutMs) || 30000))
      const summaryResult = reusableSummary(session, range, mem, sourceText, locked) ?? await summarizeDetailed({
        taskStage:'compaction',
        session,
        previousSummary: prevSummary,
        sourceText,
        lockedText,
        maxTokens,
        timeoutMs,
        signal,
      })
      const summary = summaryResult.text
      if (!summary.trim()) throw new Error('摘要生成失败')
      validateDetailedSummary(summary, sourceText, locked)
      const summaryBlocks = summaryResult.summary
      const checkpointMessage = {
        id: randomUUID(),
        role: 'user',
        content: [
          { type: 'text', text: '这是自动生成的剧情记忆检查点。请把它视为已发生的背景，只从后续消息继续剧情，不要复述或提及整理过程。\n\n<compacted-summary>' },
          ...summaryBlocks,
          { type: 'text', text: '</compacted-summary>' },
        ],
        source: { kind: 'plugin', plugin: 'compact', compactionId, ...(sourceCommandId === undefined ? {} : { sourceCommandId }) },
      }

      // 用当前路由定价比较实际替换消息；没有 estimateMessage 的兼容环境
      // 才退回字符启发式。必须真正降低下一次请求压力。
      const checkpointTokens = typeof ctx.tokenMeter.estimateMessage === 'function'
        ? Number(ctx.tokenMeter.estimateMessage(checkpointMessage))
        : estimateTokens(checkpointMessage.content.map((block) => block.text ?? '').join('\n'))
      if (checkpointTokens >= range.routeTokenCount) {
        throw new Error('摘要不小于被遮蔽内容，放弃本次整理')
      }

      // 只要求被选 span 保持不变；摘要期间追加到尾部的新消息不应让已完成工作作废。
      signal?.throwIfAborted?.()
      assertSelectedSurfaceStable(session, range)
      assertBranchActive(session)
      const summaryEvent = session.append('compaction/summary', {
        compactionId,
        ...(sourceCommandId === undefined ? {} : { sourceCommandId }),
        summary: summaryBlocks,
        ...(summaryResult.reused ? {} : { rawOutput: summaryResult.rawOutput, nativeTask: true }),
        shadowedRange: { start: range.start, end: range.end },
        shadowedSeqs: [...range.shadowedSeqs],
        shadowedTokenCount: range.shadowedTokenCount,
        // Reused/legacy summaries without attribution are unknown, never a
        // guessed current selection or a stale YAML worker default.
        provider: summaryResult.actualRoute?.provider ?? 'unknown',
        model: summaryResult.actualRoute?.model ?? 'unknown',
        maxTokens,
        ...(summaryResult.usage === undefined ? {} : { usage: summaryResult.usage }),
      })
      const checkpointEvent = session.append(
        'user/message',
        checkpointMessage,
        {
          surfaceOp: { op: 'replace', start: range.start, end: range.end },
          sourceEventSeqs: [startEvent.seq, summaryEvent.seq, ...range.shadowedSeqs],
        }
      )
      const endEvent = session.append('compaction/end', lifecycle)
      closed = true

      // 更新记忆账本（经 roleplay 服务，单写者）
      const currentEngine = getEngine()
      if (currentEngine && typeof currentEngine.memoryUpdate === 'function') {
        try {
          await currentEngine.memoryUpdate(session.id, {
            summary,
            lastCompactedSeq: range.end,
            surfaceCheckpointSeq: checkpointEvent.seq,
            // Explicit ownership/provenance lets a child safely recover a
            // copied head when its checkpoint is lazy-loaded.  Do not rely on
            // wall-clock fields or a generic `sessionId` alone for summaries.
            summarySessionId: session.id,
            summaryAtSeq: checkpointEvent.seq,
            archives: [...(mem.archives ?? []), { compactionId, sessionId: session.id, range: { start: range.start, end: range.end }, seqs: range.shadowedSeqs, storySeqs: range.storySeqs, atSeq: summaryEvent.seq, checkpointSeq: checkpointEvent.seq, time: Date.now() }].slice(-50),
          })
        } catch (error) {
          // surface 检查点已经完整提交并闭合，账本镜像失败不能伪装成事务失败。
          ctx.logger?.warn?.(`roleplay-memory: memory ledger update failed: ${errorText(error)}`)
        }
      }
      if (manual && typeof ctx.sessions.flush === 'function') await ctx.sessions.flush(session)
      return {
        compactionId,
        ...(sourceCommandId === undefined ? {} : { sourceCommandId }),
        startSeq: startEvent.seq,
        summarySeq: summaryEvent.seq,
        endSeq: endEvent.seq,
        summary: summaryBlocks,
        shadowedRange: { start: range.start, end: range.end },
        shadowedSeqs: [...range.shadowedSeqs],
        shadowedTokenCount: range.shadowedTokenCount,
      }
    } catch (error) {
      if (startEvent && lifecycle && !closed) {
        try {
          session.append('compaction/end', { ...lifecycle, error: errorText(error) })
          closed = true
        } catch (closeError) {
          throw new Error(`记忆整理失败，且 compaction/end(error) 闭合失败：${errorText(closeError)}`, { cause: error })
        }
      }
      throw error
    } finally {
      busy.delete(session.id)
    }
  }

  async function summarize(ctx, { session, system, user, maxTokens, timeoutMs, signal, validate, taskStage, background=false, sourceSeqs }) {
    const engine=ctx.get('roleplay')
    if(!engine?.nativeTask)throw new Error('原生酒馆任务服务尚未就绪')
    const validateCombined=value=>{
      if(!value||typeof value.text!=='string'||!Array.isArray(value.deltas)||!Array.isArray(value.conflicts))throw new Error('后台记忆需要笔记、正史增量和冲突数组')
      validate(value.text)
      for(const item of value.deltas)if(typeof item?.summary!=='string'||!item.summary.trim()||!['established','uncertain'].includes(item.status)||!Number.isSafeInteger(item.evidenceSeq))throw new Error('正史增量格式无效')
      for(const item of value.conflicts)if(typeof item?.claim!=='string'||typeof item?.canon!=='string'||!['low','medium','high'].includes(item.severity)||!Number.isSafeInteger(item.evidenceSeq))throw new Error('连续性记录格式无效')
      const allowed=new Set(sourceSeqs??[])
      for(const item of [...value.deltas,...value.conflicts])if(!allowed.has(item.evidenceSeq))throw new Error('后台记忆引用了本批次以外的来源')
      return value
    }
    let actualRoute
    const result=await engine.nativeTask({session,system,user,kind:'memory',format:background?'json':'text',maxTokens,timeoutMs,signal,
      validate:background?validateCombined:validate,taskStage,background,
      onResult:job=>{actualRoute=job.actualRoute?{...job.actualRoute}:undefined}})
    const text=background?result.text:result
    const summary=[{type:'text',text}]
    return {text,summary,rawOutput:summary,execution:'native-task',actualRoute,...(background?{deltas:result.deltas,conflicts:result.conflicts}:{})}
  }
  // ── compaction 服务 ────────────────────────────────────────────────────────

  async function organizeAutomatically(agent, { checkpoint = false } = {}) {
    const session = agent?.session
    if (disposed || (!checkpoint && cfg.autoNotes === false) || !session || !isRoleplaySession(session)) return null
    if (!checkpoint && !memoryNotesCadence(session, getEngine()?.memoryHead?.(session.id), Number(getEngine()?.settings?.(session.id)?.autoNotesEveryTurns)||cfg.autoNotesEveryTurns).due) return null
    const state = automaticNotes.get(session.id) ?? { failures: 0, retryAt: 0, promise: null, timer: null }
    automaticNotes.set(session.id, state)
    state.agent = agent
    if (state.promise) {
      state.rerun = true
      return state.promise
    }
    if ((!checkpoint && Date.now() < state.retryAt) || notesBusy.has(session.id)) return null
    const controller = new AbortController()
    state.controller = controller
    const job = refreshDirectorNotes(session, agent, controller.signal, undefined, { automatic: true, background:true })
      .then((result) => {
        state.failures = 0
        state.retryAt = 0
        state.error = null
        return result
      }).catch((error) => {
        if (!disposed) {
          backoff(state, error)
          ctx.logger?.warn?.(`roleplay-memory: background notes failed; keeping previous notes until a new source or explicit retry: ${state.error}`)
        }
        return null
      }).finally(() => {
        state.promise = null
        state.controller = null
        // Failure alone must not schedule paid retries of an unchanged snapshot.
        // A queued newer story still gets one check; the durable task layer keeps
        // failed generations terminal until an explicit retry or new source.
        if (!disposed && state.rerun) {
          clearTimeout(state.timer)
          state.rerun = false
          state.timer = setTimeout(() => {
            state.timer = null
            organizeAutomatically(state.agent).catch(() => {})
          }, Math.max(1, state.retryAt - Date.now()))
          state.timer.unref?.()
        }
      })
    state.promise = job
    return job
  }

  function scheduleNotes(agent) {
    const session = agent?.session
    if (!session || !isRoleplaySession(session) || disposed) return
    const state = automaticNotes.get(session.id) ?? { failures: 0, retryAt: 0, promise: null, timer: null }
    automaticNotes.set(session.id, state)
    state.agent = agent
    if (state.promise) { state.rerun = true; return }
    if (state.timer) return
    state.timer = setTimeout(() => {
      state.timer = null
      organizeAutomatically(state.agent).catch(() => {})
    }, Math.max(1, state.retryAt - Date.now()))
    state.timer.unref?.()
  }

  async function compactAutomatically(agent, trigger, signal) {
    const session = agent?.session
    if (!session || !isRoleplaySession(session) || busy.has(session.id)) return null
    const state = automaticCompaction.get(session.id) ?? { failures: 0, retryAt: 0 }
    automaticCompaction.set(session.id, state)
    if (Date.now() < state.retryAt) return null
    try {
      if (trigger !== 'context-overflow' && !branchTokensAboveThreshold(session)) return null
      const result = await compact(session, agent, signal, undefined, { force: trigger === 'context-overflow', manual: false })
      state.failures = 0
      state.retryAt = 0
      return result
    } catch (error) {
      if (!signal?.aborted) backoff(state, error)
      throw error
    }
  }

  const svc = {
    backgroundMemory: true,
    prefetchWindowCheckpoint(agent) {
      return organizeAutomatically(agent, { checkpoint: true })
    },
    async ensureWindowCheckpoint(agent, signal) {
      const session = agent?.session
      if (!session || !isRoleplaySession(session)) throw new Error('当前会话不是角色扮演会话')
      const wait = async (job) => {
        signal?.throwIfAborted?.()
        if (!signal) return job
        let abort
        try {
          return await Promise.race([job, new Promise((_, reject) => {
            abort = () => reject(signal.reason ?? new Error('检查点等待已取消'))
            signal.addEventListener('abort', abort, { once: true })
          })])
        } finally { signal.removeEventListener('abort', abort) }
      }
      // Only eviction waits for a frozen background snapshot. A newer tail
      // may have appeared while it ran, so recheck before saving the remainder.
      // Wait through scheduler cleanup too. Waiting only the raw writer can
      // reuse its already-resolved state.promise and skip the newer tail.
      const active = automaticNotes.get(session.id)?.promise ?? activeNotes.get(session.id)
      if (active) {
        try { await wait(active) } catch (error) { if (signal?.aborted) throw error }
      }
      const covered = () => {
        const entries = selectedStoryHistory(session)
        const notes = directorNotesForBranch(getEngine()?.memoryHead?.(session.id), session, entries)
        return { entries, notes, complete: entries.length === (notes?.sourceKeys.length ?? 0) }
      }
      let proof = covered()
      if (!proof.complete) {
        await wait(organizeAutomatically(agent, { checkpoint: true }))
        proof = covered()
      }
      signal?.throwIfAborted?.()
      assertBranchActive(session)
      if (!proof.complete) throw new Error('窗口检查点未保存完整，保留当前窗口；请重试')
      return { schemaVersion: 1, status: 'ready', branchId: session.id,
        generationId: proof.notes?.generationId ?? null,
        sourceKeys: historySourceKeys(proof.entries), sourceSeqs: proof.entries.map(entry => entry.seq) }
    },
    async finishTurn(agent,signal) {
      const session=agent?.session
      if(cfg.autoNotes===false||!session||!isRoleplaySession(session))return null
      scheduleNotes(agent)
      return memoryNotesCadence(session,getEngine()?.memoryHead?.(session.id),Number(getEngine()?.settings?.(session.id)?.autoNotesEveryTurns)||cfg.autoNotesEveryTurns)
    },
    settingsDefaults(){return {autoNotesEveryTurns:cfg.autoNotesEveryTurns,targetContextTokens:cfg.targetContextTokens,archiveTokens:cfg.archiveTokens}},
    async resumeTask(agent,signal,stage) {
      const session=agent?.session
      if(!session||!isRoleplaySession(session))throw new Error('当前会话不是角色扮演会话')
      // Already inside the main loop. Never enter agent.runMaintenance here.
      return stage==='compaction'?compact(session,agent,signal,undefined,{force:true,manual:false})
        :refreshDirectorNotes(session,agent,signal,undefined,{automatic:true})
    },
    storyEvidence(session) {
      return session && isRoleplaySession(session) ? selectedStoryHistory(session) : []
    },
    legacyCadenceSlotsFor(session, record) {
      return session && isRoleplaySession(session) ? legacyCadenceSlots(selectedStoryHistory(session), record) : []
    },
    memoryProjection(session) {
      if (!session || !isRoleplaySession(session)) return null
      const projected = memoryForSession(session)
      if (!projected) return null
      const history = selectedStoryHistory(session)
      const live = new Set([...surfaceSeqsOf(session), ...history.map(entry => entry.seq)])
      const scoped = items => (Array.isArray(items) ? items : []).filter(item => {
        const seq = provenanceSeqOf(item)
        return seq !== null && live.has(seq)
      })
      const checkpoint = checkpointSummaryFromSurface(session)
      return { ...projected, summary: checkpoint?.text ?? '',
        deltas: scoped(projected.deltas), pendingConfirmations: scoped(projected.pendingConfirmations),
        archiveDigests: scoped(projected.archiveDigests),
        directorNotes: directorNotesForBranch(getEngine()?.memoryHead?.(session.id), session, history) }
    },
    async prepareForTurn(agent, signal) {
      const session = agent?.session
      if (!session || !isRoleplaySession(session)) return null
      await getEngine()?.awaitCommitted?.(session.id)
      // These are live promise handles, not a persisted 'busy' flag. A stale
      // job rejects on its existing source-key fence; then rebuild this branch.
      for (const jobs of [activeCompactions]) {
        const active = jobs.get(session.id)
        if (active) { try { await active } catch (error) { if (signal?.aborted) throw error } }
      }
      signal?.throwIfAborted?.()
      if (getEngine()?.ownsMemoryPreparation !== true && cfg.auto !== false && branchTokensAboveThreshold(session)) {
        await compact(session, agent, signal, undefined, { manual: false })
      }
      if (cfg.autoNotes !== false) scheduleNotes(agent)
      const entries = selectedStoryHistory(session)
      const notes = directorNotesForBranch(getEngine()?.memoryHead?.(session.id), session, entries)
      return { schemaVersion: 1, branchId: session.id, generationId: randomUUID(),
        sourceSeqs: entries.map(entry => entry.seq), status: 'ready',
        notesStatus:notes?(notes.pendingEntries?'verified-prefix':'current'):'pending',
        pendingEntries:entries.length-(notes?.sourceKeys.length??0) }
    },
    directorNotes(session) {
      if (!session || !isRoleplaySession(session)) return null
      return directorNotesForBranch(getEngine()?.memoryHead?.(session.id), session)
    },
    async saveDirectorNotes(session, text) {
      if (!session || !isRoleplaySession(session)) throw new Error('当前会话不是角色扮演会话')
      const entries = selectedStoryHistory(session)
      notesGeneration.set(session.id, (notesGeneration.get(session.id) ?? 0) + 1)
      await writeNotes(session.id, () => getEngine().memoryUpdate(session.id, { directorNotes: {
        schemaVersion: 1, generationId: randomUUID(), branchId: session.id,
        text: String(text), sourceKeys: historySourceKeys(entries), sourceSeqs: entries.map((entry) => entry.seq),
        sessionId: session.id, sourceEntryCount: entries.length, throughSeq: entries.at(-1)?.seq ?? -1,
        updatedAt: Date.now(), manual: true,
      }, notesCadence: { schemaVersion: 1, branchId: session.id, slots: storyCadenceSlots(entries),
        updatedAt: Date.now(), throughSeq: entries.at(-1)?.seq ?? -1 } }))
    },
    history(session, options) {
      if (!session || !isRoleplaySession(session)) throw new Error('当前会话不是角色扮演会话')
      return queryStoryHistory(session, options)
    },
    historyRead(session, options) {
      if (!session || !isRoleplaySession(session)) throw new Error('当前会话不是角色扮演会话')
      return readStoryHistory(session, options)
    },
    async organizeNow(agent, signal, commandId) {
      const session = agent?.session
      if (!session || !isRoleplaySession(session)) throw new Error('当前会话不是角色扮演会话')
      const task = (maintenanceSignal) => refreshDirectorNotes(session, agent,
        signal && maintenanceSignal ? AbortSignal.any([signal, maintenanceSignal]) : signal ?? maintenanceSignal, commandId)
      return typeof agent.runMaintenance === 'function' ? agent.runMaintenance(task) : task(signal)
    },
    organizeIfNeeded: organizeAutomatically,
    async rebuildDirectorNotes(agent, signal, commandId) {
      const session = agent?.session
      if (!session || !isRoleplaySession(session)) throw new Error('当前会话不是角色扮演会话')
      const task = (maintenanceSignal) => refreshDirectorNotes(session, agent,
        signal && maintenanceSignal ? AbortSignal.any([signal, maintenanceSignal]) : signal ?? maintenanceSignal,
        commandId, { force: true })
      return typeof agent.runMaintenance === 'function' ? agent.runMaintenance(task) : task(signal)
    },
    async compactNow(agent, signal, commandId) {
      const session = agent?.session
      if (!session || !isRoleplaySession(session)) throw new Error('当前会话不是角色扮演会话')
      signal?.throwIfAborted?.()
      if (typeof agent.runMaintenance !== 'function') {
        return compact(session, agent, signal, commandId, { force: true, manual: true })
      }
      return agent.runMaintenance(async (maintenanceSignal) => {
        const operationSignal = signal
          ? AbortSignal.any([maintenanceSignal, signal])
          : maintenanceSignal
        return compact(session, agent, operationSignal, commandId, { force: true, manual: true })
      })
    },
    async compactIfNeeded(agent, trigger = 'pressure', signal) {
      const session = agent?.session
      if (!session || !isRoleplaySession(session)) return null
      if (busy.has(session.id)) return null
      // Compatibility with the early local draft which accepted
      // compactIfNeeded(agent, signal), while honoring the official
      // (agent, trigger, signal) contract from alpha.3.
      if (trigger && typeof trigger !== 'string') {
        signal = trigger
        trigger = 'pressure'
      }
      return compactAutomatically(agent, trigger, signal)
    },
  }
  ctx.provide('compaction', svc)

  // ── 自动触发（agent/pre-step，注册在 roleplay-core 之前）──────────────────
  // 阈值计算当前选择分支的完整模型表面（含 fork seed、既有摘要与新剧情），
  // 且支持每分支设置覆盖（侧边栏可调）。

  function branchTokensAboveThreshold(session) {
    let measurement
    try {
      measurement = ctx.tokenMeter.measure(session)
    } catch (error) {
      throw new Error(`无法计量当前分支上下文：${String(error?.message ?? error)}`, { cause: error })
    }
    const nodes = measurement?.nodes
    if (!Array.isArray(nodes) || nodes.length === 0) return false
    const total = pressureTokens(session, measurement)
    const settings = branchSettings(session)
    const target = Number(settings?.targetContextTokens) || Number(cfg.targetContextTokens) || 262144
    const hysteresis = Math.max(0, Number(settings?.hysteresisTokens ?? cfg.hysteresisTokens) || 0)
    const triggerAt = Math.max(1, target - Math.min(target - 1, hysteresis))
    return total >= triggerAt
  }

  if (cfg.auto !== false) {
    ctx.on('agent/pre-step', (payload, next) => {
      const session = payload?.agent?.session
      if (!session || !isRoleplaySession(session)) return next()
      if (payload.step !== 1) return next()
      const hasUser = payload.messages.some((m) => m.role === 'user' && m.source?.kind === 'user')
      if (!hasUser) return next()
      if (getEngine()?.ownsMemoryPreparation === true) return next()
      if (busy.has(session.id)) return next()
      return (async () => {
        try {
          await compactAutomatically(payload.agent, 'pressure', payload.signal)
        } catch (error) {
          ctx.logger?.warn?.(`roleplay-memory: auto compaction failed: ${String(error)}`)
        }
        return next()
      })()
    })
  }

  if (cfg.autoNotes !== false) {
    ctx.on('session/event', (session, event) => {
      if (isCompletedTurnEnd(event)) scheduleNotes({ session })
    }, { global: true })
    ctx.on('agent/status', (payload) => {
      if (payload?.status === 'idle') scheduleNotes(payload.agent)
    })
  }

  // ── /memory 命令 ───────────────────────────────────────────────────────────

  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
          name: 'memory',
          description: '角色扮演记忆管理：view / organize（更新导演笔记）/ compact（归档旧剧情）/ history / search / lock / unlock / note',
          input: { hint: 'view | organize | compact | history | search <关键词> | lock <事实> | unlock <编号> | note <事实>' },
          handler: async (invocation) => {
            const session = invocation.agent?.session
            if (!session || !isRoleplaySession(session)) return { kind: 'error', text: '当前会话不是角色扮演会话' }
            const raw = (invocation.rawInput ?? '').trim()
            const [verb, ...rest] = raw.split(/\s+/)
            const arg = rest.join(' ').trim()

            if (!verb || verb === 'view') {
              const mem = memoryForSession(session)
              if (!mem) return { kind: 'success', text: '（尚无记忆账本）' }
              const lines = []
              lines.push(`记忆账本版本 ${mem.version ?? 1}，增量 ${(mem.deltas ?? []).length} 条，锁定事实 ${(mem.lockedFacts ?? []).length} 条`)
              if (mem.directorNotes?.text) lines.push(`\n导演笔记（已覆盖 ${mem.directorNotes.sourceEntryCount} 条剧情，待整理 ${mem.directorNotes.pendingEntries} 条）：\n${mem.directorNotes.text.slice(0, 12000)}`)
              if (mem.summary) lines.push(`\n当前摘要（${mem.summary.length} 字符，最近整理覆盖至 seq ${mem.lastCompactedSeq ?? '?'}）：\n${mem.summary.slice(0, 2400)}`)
              const deltas = (mem.deltas ?? []).slice(-20)
              if (deltas.length) lines.push('\n最近增量：\n' + deltas.map((d) => `- (seq ${d.evidenceSeq}) [${d.status}] ${d.summary}`).join('\n'))
              if ((mem.lockedFacts ?? []).length) lines.push('\n锁定事实：\n' + mem.lockedFacts.map((f, i) => `${i}: ${typeof f === 'string' ? f : f.text}`).join('\n'))
              const pc = (mem.pendingConfirmations ?? []).slice(-6)
              if (pc.length) lines.push('\n待确认冲突：\n' + pc.map((c) => `- [${c.severity}] ${c.claim} ← 与「${c.canon}」冲突`).join('\n'))
              return { kind: 'success', text: lines.join('\n') }
            }
            if (verb === 'organize') {
              try {
                const result = await svc.organizeNow(invocation.agent, invocation.signal, invocation.commandId)
                return { kind: 'success', text: result.reason === 'no-completed-story'
                  ? '当前还没有已完成的剧情；未修改会话。'
                  : result.changed ? `导演笔记已保存：覆盖当前分支 ${result.entries} 条剧情，${result.chars} 字符。剧情原文与上下文未改动。`
                    : `导演笔记已是最新状态：覆盖当前分支 ${result.entries} 条剧情。` }
              } catch (error) {
                return { kind: 'error', text: `导演笔记整理失败：${String(error?.message ?? error)}` }
              }
            }
            if (verb === 'history' || verb === 'search') {
              const result = queryStoryHistory(session, { query: verb === 'search' ? arg : '', maxChars: 12000 })
              return { kind: 'success', text: JSON.stringify(result) }
            }
            if (verb === 'compact') {
              try {
                const result = await svc.compactNow(invocation.agent, invocation.signal, invocation.commandId)
                if (result === null) {
                  return { kind: 'success', text: '当前没有可安全整理的完整剧情区间；未修改会话。' }
                }
                return {
                  kind: 'success',
                  text: `整理完成：归档当前分支 surface ${result.shadowedRange.start}…${result.shadowedRange.end}（${result.shadowedSeqs.length} 个节点 / ${result.shadowedTokenCount} tokens），摘要 ${textOf(result.summary).length} 字符。原文事件仍完整保留在日志中。`,
                }
              } catch (error) {
                return { kind: 'error', text: `整理失败：${String(error?.message ?? error)}` }
              }
            }
            if (verb === 'note' || verb === 'lock') {
              if (!arg) return { kind: 'error', text: '用法：/memory lock <要永久锁定的事实>' }
              const engine = getEngine()
              const mem = memoryForSession(session)
              const facts = [...(mem?.lockedFacts ?? []).map((f) => (typeof f === 'string' ? { text: f } : f))]
              facts.push({ text: arg, atSeq: lastSeqOf(session), sessionId: session.id, lockedBy: 'user' })
              if (engine?.memoryUpdate) await engine.memoryUpdate(session.id, { lockedFacts: facts })
              return { kind: 'success', text: `已锁定事实（第 ${facts.length} 条）：${arg}` }
            }
            if (verb === 'unlock') {
              const idx = Number(arg)
              if (!Number.isInteger(idx)) return { kind: 'error', text: '用法：/memory unlock <编号>（编号见 /memory view）' }
              const engine = getEngine()
              const mem = memoryForSession(session)
              const facts = [...(mem?.lockedFacts ?? []).map((f) => (typeof f === 'string' ? { text: f } : f))]
              if (idx < 0 || idx >= facts.length) return { kind: 'error', text: `编号 ${idx} 不存在` }
              const [removed] = facts.splice(idx, 1)
              if (engine?.memoryUpdate) await engine.memoryUpdate(session.id, { lockedFacts: facts })
              return { kind: 'success', text: `已解锁：${removed.text}` }
            }
            return { kind: 'error', text: '用法：/memory view | organize | lock <事实> | unlock <编号> | note <事实>' }
          },
        })
  })

  ctx.logger?.info?.('roleplay-memory-engine: mounted')
}
