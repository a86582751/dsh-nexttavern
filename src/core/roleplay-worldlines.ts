import { randomUUID } from 'node:crypto'
import { completedAssistantReceiptForTurn } from './roleplay-context.js'
import type { TaskBlock } from './tavern-task-context.js'
import type { WorldlineDependencies, ReadBranchSession, BranchSession, StoryEvent, ForkAnchor, ForkGroup, ForkMember, ForkOperation, ForkLookup, BranchProjection, PlayerProjection, PlayerTarget, SurfaceEntry, RegistrationResult, ReplacementResult } from './roleplay-worldline-types.js'

const isReplacementEvent = (event: StoryEvent | undefined): event is StoryEvent & {surfaceOp: {op: string; start: number; end: number}} => typeof event?.surfaceOp === 'object' && event.surfaceOp?.op === 'replace'

export function assertBranchSession(session: ReadBranchSession): asserts session is BranchSession {
  if (!('append' in session) || typeof session.append !== 'function') throw new Error('会话暂不可写入分支历史')
}

export function createRoleplayWorldlines(deps: WorldlineDependencies) {
  const { ctx } = deps
  const { safeId, keyOf, sha256, T, eventsOf, isCompletedTurnEnd, surfaceEvents, textOf, cloneBranchRecord, internalTaskSeqs, importActiveKey, resolveRoleplaySession, isRoleplaySession, ensureState, ensureBranch, durableSeq, canonicalAssistantForTurn, surfaceEntries, withDecisionMutationLock, normalizeDecisionRecord, cloneRecord, provenanceSeq } = deps

  const forkGroupKey = (groupId: unknown) => `fork-group-${safeId(groupId)}`
  const forkOperationKey = (operationId: unknown) => `fork-op-${safeId(operationId)}`
  const forkAnchorKey = (sessionId: string, messageId: unknown) => keyOf(sessionId, `fork-anchor-${sha256(messageId).slice(0, 24)}`)
  const forkPendingKey = (sessionId: string, groupId: unknown) => keyOf(sessionId, `fork-pending-${safeId(groupId)}`)
  const editInvalidationKey = (sessionId: string, role: string, replacementSeq: number) =>
    keyOf(sessionId, `edit-invalidated-${role}-${safeId(replacementSeq)}`)
  const playerProjectionKey = (sessionId: string, groupId: string, playerVariantId: string) =>
    keyOf(sessionId, `player-projection-${sha256(`${groupId}\0${playerVariantId}`).slice(0, 32)}`)
  const forkAnchorLockKey = (anchor: Pick<ForkAnchor, 'sourceSessionId' | 'sourceAssistantMessageId'>) => {
    const sourceId = String(anchor?.sourceSessionId ?? '')
    const messageId = String(anchor?.sourceAssistantMessageId ?? '')
    return `anchor:${sourceId}:${sha256(messageId).slice(0, 24)}`
  }
  const forkGroupLockKey = (groupId: unknown) => {
    const group = hydrateForkGroup(T.branch.get(forkGroupKey(groupId)))
    return group?.anchor ? forkAnchorLockKey(group.anchor) : `group:${safeId(groupId)}`
  }
  const forkMutationLocks = new Map<string, Promise<void>>()

  async function withForkMutationLock<T>(key: string, work: () => Promise<T>): Promise<T> {
    const prior = forkMutationLocks.get(key) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolveGate) => { release = resolveGate })
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

  function visibleSeqSet(session: ReadBranchSession) {
    const nodes = session?.surface?.nodes
    return nodes && typeof nodes[Symbol.iterator] === 'function'
      ? new Set(Array.from(nodes, Number).filter(Number.isSafeInteger))
      : new Set<number>()
  }

  function assistantMessageId(event: StoryEvent | null | undefined) {
    const value = event?.data?.message?.id ?? event?.data?.messageId
    return value === undefined || value === null ? '' : String(value)
  }

  function completedTurns(session: ReadBranchSession) {
    return new Set(eventsOf(session)
      .filter(isCompletedTurnEnd)
      .map((event) => Number(event.data?.turn))
      .filter(Number.isSafeInteger))
  }

  function turnForEvent(session: ReadBranchSession, event: StoryEvent) {
    const limit = Number(event?.seq)
    if (!Number.isSafeInteger(limit)) return null
    for (let index = Math.min(limit, eventsOf(session).length - 1); index >= 0; index -= 1) {
      const candidate = eventsOf(session)[index]
      if (candidate?.type === 'turn/start' && Number.isSafeInteger(Number(candidate.data?.turn))) {
        return Number(candidate.data?.turn)
      }
    }
    return null
  }

  function requestUserEvent(session: ReadBranchSession, requestId: unknown) {
    if (typeof requestId !== 'string' || !requestId) return null
    return [...surfaceEvents(session)].reverse().find((event) =>
      event?.type === 'user/message' &&
      event.data?.source?.kind === 'user' &&
      String(event.data?.source?.rpcId ?? '') === requestId) ?? null
  }

  function currentSurfaceUserBefore(session: ReadBranchSession, assistantEvent: StoryEvent) {
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

  function hydrateForkGroup(value: unknown): ForkGroup | null {
    if (!value || typeof value !== 'object') return null
    // Legacy records are repaired on this clone; retain unknown durable fields
    // and the runtime checks below even as the internal contracts become typed.
    const group = cloneBranchRecord(value) as ForkGroup
    group.schemaVersion = 2
    group.members = Array.isArray(group.members) ? group.members : []
    group.playerVariants = group.playerVariants && typeof group.playerVariants === 'object' && !Array.isArray(group.playerVariants)
      ? group.playerVariants
      : {}
    const ordered = [...group.members].sort((a, b) => Number(a?.ordinal) - Number(b?.ordinal))
    let nextPlayerOrdinal = 1
    let inheritedVariant = `${group.groupId}:player:1`
    const ordinalByVariant = new Map<string, number>()
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

  function sessionLineageIds(session: ReadBranchSession) {
    const ids = []
    let current: ReadBranchSession | undefined = session
    for (let depth = 0; current && depth < 64; depth += 1) {
      ids.push(current.id)
      const parentId = current.header?.parentSession
      if (!parentId) break
      current = ctx.sessions.get(parentId)
    }
    return ids
  }

  function buildForkLookupIndex(session: ReadBranchSession): ForkLookup {
    const lineage = new Set<string | undefined>(sessionLineageIds(session))
    const bySessionMessage = new Map<string, string>()
    const groups = []
    for (const [key, raw] of T.branch.entries()) {
      if (!String(key).startsWith('fork-group-')) continue
      // Hydration clones all player variants. Unrelated conversations cannot
      // participate in this session's pointer recovery or failure navigation.
      if (!lineage.has(raw?.rootSessionId) && !lineage.has(raw?.anchor?.sourceSessionId) &&
        !(Array.isArray(raw?.members) && raw.members.some(member => lineage.has(member?.sessionId)))) continue
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

  function forkPointerFor(session: ReadBranchSession, messageId: unknown, lookup: ForkLookup | null = null) {
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
      if (Array.isArray(raw?.members) && raw.members.some((member) =>
        !member.deleted && lineage.includes(member.sessionId) && member.assistantMessageId === messageId)) {
        return { groupId: raw.groupId, recovered: true }
      }
    }
    return null
  }

  function groupMemberForSession(group: ForkGroup | null, session: ReadBranchSession, messageId: unknown, { includeDeleted = false } = {}) {
    for (const sessionId of sessionLineageIds(session)) {
      const member = group?.members?.find((item) =>
        (includeDeleted || !item.deleted) && item.sessionId === sessionId && item.assistantMessageId === messageId)
      if (member) return member
    }
    return null
  }

  function locateForkTarget(session: ReadBranchSession, requestedMessageId: unknown): ForkAnchor {
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
    const assistant = events[assistantIndex]!

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
        previousTurnEndSeq = Number(events[index]!.seq)
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

  async function copyStaticBranchConfig(sourceId: string, childId: string) {
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

  async function bootstrapChildBranch(operation: ForkOperation, child: BranchSession) {
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

  async function registerNativeFork(operation: ForkOperation, child: BranchSession, lockAttempt = 0): Promise<RegistrationResult | null> {
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

  function failedForkMembership(session: ReadBranchSession, userEvent: StoryEvent, lookup = buildForkLookupIndex(session)) {
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

  function isRecoverySourceMember(member: ForkMember | null | undefined, anchor: ForkAnchor | null | undefined, userEvent?: StoryEvent) {
    if (!member || member.sessionId !== anchor?.sourceSessionId) return false
    if (Number.isSafeInteger(Number(anchor?.sourceUserSeq)) && Number(member.userSeq) === Number(anchor!.sourceUserSeq)) return true
    if (anchor?.sourceUserMessageId && String(member.userMessageId ?? '') === String(anchor.sourceUserMessageId)) return true
    const requestId = String(userEvent?.data?.source?.rpcId ?? '')
    return Boolean(requestId && String(member.requestId ?? '') === requestId)
  }

  async function backfillRecoverySourceMember(anchor: ForkAnchor) {
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
      .map(([, value]) => hydrateForkGroup(value)).filter(value => value !== null)
    if (candidates.length !== 1) return false
    const groupId = candidates[0]!.groupId
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

  async function registerRecoveryFork(operation: ForkOperation, child: BranchSession) {
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
    if (!source || !recovery) throw new Error('原始失败轮次已变更、删除或仍在运行，不能登记恢复分支')
    const sourceEvent = userForkContext(source, anchor.sourceUserSeq).event
    const membership=source&&recovery
      ?failedForkMembership(source,sourceEvent):null
    const lockKey = membership?forkGroupLockKey(membership.group.groupId):`recovery:${anchor.sourceSessionId}:${Number(anchor.sourceUserSeq)}`
    return withForkMutationLock(lockKey, async () => {
      await bootstrapChildBranch(operation, child)
      const groupId = membership?.group.groupId??`g-recovery-${sha256(`${anchor.sourceSessionId}\0${anchor.sourceUserSeq}`).slice(0, 32)}`
      let group = hydrateForkGroup(T.branch.get(forkGroupKey(groupId)))
      const originalMember = (ordinal: number, playerVariantId: string, playerOrdinal: number): ForkMember => ({
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

  async function reconcileNativeFork(session: ReadBranchSession, completedAssistant: StoryEvent | null = null) {
    const prefix = `${session.id}__fork-pending-`
    const pendingEntries = [...T.branch.entries()].filter(([key, value]) => key.startsWith(prefix) && value)
    if (!pendingEntries.length) return
    for (const [pendingKey, pending] of pendingEntries) {
      const requestId = String(pending?.requestId ?? '')
      const userEvent = requestUserEvent(session, requestId)
      const turn = userEvent ? turnForEvent(session, userEvent) : null
      const candidate = completedAssistant && Number(completedAssistant.data?.turn) === Number(turn)
        ? completedAssistant
        : turn === null ? null : completedAssistantReceiptForTurn(session, turn)
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

  async function failPendingNativeFork(session: ReadBranchSession, reason: unknown) {
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

  async function repairLegacyRootForkPointer(session: ReadBranchSession, lookup: ForkLookup | null = null) {
    const visible = surfaceEvents(session)
    const visibleAssistants = visible.filter((event) => event?.type === 'assistant/message')
    const visibleIds = new Set<string | null | undefined>(visibleAssistants.map(assistantMessageId).filter(Boolean))
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
        isReplacementEvent(event) && replacementLineageContains(session, event, oldSeq))
      // Ambiguous legacy evidence is deliberately left untouched.  In a long
      // Session several historical groups can coexist; selecting the last
      // assistant merely by seq would point all of them at the newest turn.
      if (placeholders.length !== 1) continue
      const placeholderPosition = placeholders[0]!.position
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
      const candidates = visible.slice(markers[0]!.position + 1, boundary)
        .filter((event) => event?.type === 'assistant/message')
      if (candidates.length !== 1) continue
      const candidate = candidates[0]!
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

  async function nativeBranchGroupsFor(session: ReadBranchSession, lookup: ForkLookup | null = null) {
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
    lookup = buildForkLookupIndex(session)
    const result: Record<string, BranchProjection> = {}
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

  function deletedBranchMessageIdsFor(session: ReadBranchSession, lookup: ForkLookup | null = null) {
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
  function storyBranchIsActive(session: ReadBranchSession) {
    return deletedBranchMessageIdsFor(session).length === 0
  }

  function assertStoryBranchActive(session: ReadBranchSession) {
    if (storyBranchIsActive(session)) return
    const error = Object.assign(new Error('当前剧情分支已删除；请切换到仍然活动的分支'), { code: 'ROLEPLAY_SOURCE_CHANGED' })
    throw error
  }

  function inheritedAssistantMessageIdsFor(session: ReadBranchSession, lookup: ForkLookup | null = null) {
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

  async function nativePlayerGroupsFor(session: ReadBranchSession, assistantGroups: Record<string, BranchProjection>) {
    const result: Record<string, PlayerProjection> = {}
    const entries = surfaceEntries(session)
    const publish = (user: SurfaceEntry, value: PlayerProjection) => {
      const event = eventsOf(session)[Number(user.seq)]
      const aliases = event ? replacementLineageSeqs(session, event) : [Number(user.seq)]
      if (!aliases.includes(Number(user.seq))) aliases.push(Number(user.seq))
      for (const seq of aliases) {
        if (Number.isSafeInteger(seq)) result[String(seq)] = value
      }
    }
    for (let index = 0; index < entries.length; index += 1) {
      const user = entries[index]!
      if (user.kind !== 'user') continue
      let assistant = null
      for (let next = index + 1; next < entries.length; next += 1) {
        if (entries[next]!.kind === 'user') break
        if (entries[next]!.kind === 'assistant') assistant = entries[next]
      }
      const assistantGroup = assistant?.messageId ? assistantGroups[assistant.messageId] : null
      if (!assistant?.messageId || !assistantGroup) {
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
      if (!stored || !current) continue
      const variants: { playerVariantId: string; sourceOrdinal: number; candidates: ForkMember[] }[] = []
      const byPlayerVariant = new Map<string, (typeof variants)[number]>()
      for (const member of active) {
        let variant = byPlayerVariant.get(member.playerVariantId)
        if (!variant) {
          variant = {
            playerVariantId: member.playerVariantId,
            sourceOrdinal: Number(member.playerOrdinal) || variants.length + 1,
            candidates: [],
          }
          variants.push(variant)
          byPlayerVariant.set(member.playerVariantId, variant)
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

  function replaceTextBlocks(content: readonly TaskBlock[] | undefined, text: string) {
    const source: readonly TaskBlock[] = Array.isArray(content) ? content : []
    const output: TaskBlock[] = []
    let inserted = false
    for (const block of source) {
      if (block && typeof block === 'object' && 'type' in block && block.type === 'text') {
        if (!inserted) output.push({ type: 'text', text })
        inserted = true
      } else {
        output.push(block)
      }
    }
    if (!inserted) output.unshift({ type: 'text', text })
    return output
  }

  function visibleSurfaceEvent(session: ReadBranchSession, predicate: (event: StoryEvent) => unknown) {
    return [...surfaceEvents(session)].reverse().find(predicate) ?? null
  }

  function replacementLineageContains(session: ReadBranchSession, event: StoryEvent, requestedSeq: unknown) {
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
      if (isReplacementEvent(ancestor) && Array.isArray(ancestor.sourceEventSeqs)) {
        pending.push(...ancestor.sourceEventSeqs)
      }
    }
    return false
  }

  function replacementLineageSeqs(session: ReadBranchSession, event: StoryEvent) {
    if (!event || typeof event !== 'object') return []
    const pending = [event.seq]
    const seen = new Set<number>()
    while (pending.length) {
      const seq = durableSeq(pending.pop())
      if (seq === null || seen.has(seq)) continue
      seen.add(seq)
      const candidate = eventsOf(session)[seq]
      if (isReplacementEvent(candidate) && Array.isArray(candidate.sourceEventSeqs)) {
        pending.push(...candidate.sourceEventSeqs)
      }
    }
    return [...seen].sort((left, right) => left - right)
  }

  function stableUserMessageId(session: ReadBranchSession, event: StoryEvent) {
    const candidates = replacementLineageSeqs(session, event)
      .map((seq) => eventsOf(session)[seq])
      .filter((candidate): candidate is StoryEvent => candidate?.type === 'user/message' && candidate.data?.source?.kind === 'user')
    const origin = candidates.find((candidate) => !isReplacementEvent(candidate)) ?? candidates[0] ?? event
    return String(origin?.data?.id ?? event?.data?.id ?? '')
  }

  async function repairLegacyUserReplacementIdentities(session: BranchSession) {
    let repaired = 0
    for (const event of [...surfaceEvents(session)]) {
      if (event?.type !== 'user/message' || event.data?.source?.kind !== 'user' || !isReplacementEvent(event)) continue
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

  async function replaceAssistantText(session: BranchSession, messageId: string, text: string, lockAttempt = 0): Promise<StoryEvent | null> {
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
        if (isReplacementEvent(event)) {
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
          ...event.data?.message,
          content: replaceTextBlocks(event.data?.message?.content, text),
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

  async function invalidateDerivedStoryState(session: BranchSession, { fromSeq, reason }: { fromSeq: number; reason: string }) {
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
        const keepBeforeEdit = (value: unknown) => {
          const item = value as Record<string, unknown> | null
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

  async function reconcileCanonicalPlayerVariants(session: ReadBranchSession, lookup: ForkLookup | null = null) {
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
        const identityNeedsRepair = isReplacementEvent(userEvent) &&
          String(userEvent.data?.id ?? '') !== canonicalUserMessageId
        let replacement = userEvent
        if (textChanged || identityNeedsRepair) {
          assertBranchSession(session)
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

  function userForkContext(session: ReadBranchSession, seq: unknown) {
    const requested = Number(seq)
    const event = visibleSurfaceEvent(session, (candidate) =>
      candidate?.type === 'user/message' && Number(candidate.seq) === requested && candidate.data?.source?.kind === 'user')
      ?? visibleSurfaceEvent(session, (candidate) =>
        candidate?.type === 'user/message' && candidate.data?.source?.kind === 'user' &&
        replacementLineageContains(session, candidate, requested))
    if (!event) throw new Error('当前分支中找不到这条玩家消息')
    const surface = surfaceEvents(session)
    const userIndex = surface.findIndex((candidate) => Number(candidate?.seq) === Number(event.seq))
    const internal = internalTaskSeqs(session)
    let followingAssistant = null
    for (let index = userIndex + 1; index < surface.length; index += 1) {
      if (surface[index]?.type === 'user/message' && surface[index]!.data?.source?.kind === 'user') break
      if (surface[index]?.type === 'assistant/message' && !internal.has(Number(surface[index]!.seq))) followingAssistant = surface[index]
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
  function locatePlayerRecoveryTarget(session: ReadBranchSession, seq: unknown): ForkAnchor | null {
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
      previousTurnEndSeq = Number(events[index]!.seq)
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

  async function replaceUserText(session: BranchSession, seq: unknown, text: string, lockAttempt = 0): Promise<ReplacementResult | null> {
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
      const targets: PlayerTarget[] = currentMember
        ? group!.members.filter((member) => !member.deleted && member.playerVariantId === currentMember.playerVariantId)
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
        const identityNeedsRepair = isReplacementEvent(targetEvent) &&
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
        if (!alreadyApplied || (isReplacementEvent(targetEvent) && !identityNeedsRepair && !invalidationAlreadyCommitted)) {
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

  return { storyBranchIsActive, assertStoryBranchActive, reconcileCanonicalPlayerVariants, buildForkLookupIndex, reconcileNativeFork, failPendingNativeFork, repairLegacyUserReplacementIdentities, nativeBranchGroupsFor, nativePlayerGroupsFor, assistantMessageId, userForkContext, locatePlayerRecoveryTarget, failedForkMembership, isRecoverySourceMember, backfillRecoverySourceMember, deletedBranchMessageIdsFor, inheritedAssistantMessageIdsFor, withForkMutationLock, forkOperationKey, forkPointerFor, hydrateForkGroup, forkGroupKey, groupMemberForSession, locateForkTarget, bootstrapChildBranch, registerRecoveryFork, registerNativeFork, forkAnchorLockKey, requestUserEvent, forkPendingKey, replaceAssistantText, replaceUserText }
}
