import type { TaskBlock } from './tavern-task-context.js'
import type {
  WorldlineDependencies,
  ReadBranchSession,
  BranchSession,
  StoryEvent,
  ForkAnchor,
  ForkGroup,
  ForkMember,
  ForkLookup,
  BranchProjection,
  PlayerProjection,
  PlayerTarget,
  SurfaceEntry,
  ReplacementResult,
} from './roleplay-worldline-types.js'

// Internal seam: the owner supplies its existing ledger lookup and mutation
// lock. Surface edits must serialize with fork registration, not create a
// second lock or hydrate a separate copy of durable state at initialization.
interface ForkAccess {
  forkGroupKey(groupId: unknown): string
  forkAnchorKey(sessionId: string, messageId: unknown): string
  forkAnchorLockKey(anchor: Pick<ForkAnchor, 'sourceSessionId' | 'sourceAssistantMessageId'>): string
  withForkMutationLock<T>(key: string, work: () => Promise<T>): Promise<T>
  hydrateForkGroup(value: unknown): ForkGroup | null
  forkPointerFor(session: ReadBranchSession, messageId: unknown, lookup?: ForkLookup | null): { groupId?: string } | null
  groupMemberForSession(
    group: ForkGroup | null,
    session: ReadBranchSession,
    messageId: unknown,
    options?: { includeDeleted?: boolean },
  ): ForkMember | null
  assistantMessageId(event: StoryEvent | null | undefined): string
  currentSurfaceUserBefore(session: ReadBranchSession, assistantEvent: StoryEvent): { event: StoryEvent; text: string } | null
  turnForEvent(session: ReadBranchSession, event: StoryEvent): number | null
}

type SurfaceDependencies = Pick<WorldlineDependencies,
  'ctx' | 'safeId' | 'keyOf' | 'sha256' | 'T' | 'eventsOf' | 'surfaceEvents' |
  'textOf' | 'cloneBranchRecord' | 'internalTaskSeqs' | 'isRoleplaySession' |
  'durableSeq' | 'canonicalAssistantForTurn' | 'surfaceEntries' |
  'withDecisionMutationLock' | 'normalizeDecisionRecord' | 'cloneRecord' | 'provenanceSeq'>

const isReplacementEvent = (
  event: StoryEvent | undefined,
): event is StoryEvent & { surfaceOp: { op: string; start: number; end: number } } =>
  typeof event?.surfaceOp === 'object' && event.surfaceOp?.op === 'replace'

export function assertBranchSession(session: ReadBranchSession): asserts session is BranchSession {
  if (!('append' in session) || typeof session.append !== 'function') throw new Error('会话暂不可写入分支历史')
}

// Append-only message revisions, projection repair and derived-state
// invalidation form one operation; callers keep using roleplay-worldlines.
export function createWorldlineSurface(deps: SurfaceDependencies, forks: ForkAccess) {
  const {
    ctx,
    safeId,
    keyOf,
    sha256,
    T,
    eventsOf,
    surfaceEvents,
    textOf,
    cloneBranchRecord,
    internalTaskSeqs,
    isRoleplaySession,
    durableSeq,
    canonicalAssistantForTurn,
    surfaceEntries,
    withDecisionMutationLock,
    normalizeDecisionRecord,
    cloneRecord,
    provenanceSeq,
  } = deps
  const {
    forkGroupKey,
    forkAnchorKey,
    forkAnchorLockKey,
    withForkMutationLock,
    hydrateForkGroup,
    forkPointerFor,
    groupMemberForSession,
    assistantMessageId,
    currentSurfaceUserBefore,
    turnForEvent,
  } = forks

  const editInvalidationKey = (sessionId: string, role: string, replacementSeq: number) =>
    keyOf(sessionId, `edit-invalidated-${role}-${safeId(replacementSeq)}`)
  const playerProjectionKey = (sessionId: string, groupId: string, playerVariantId: string) =>
    keyOf(sessionId, `player-projection-${sha256(`${groupId}\0${playerVariantId}`).slice(0, 32)}`)

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

  async function replaceAssistantText(
    session: BranchSession, messageId: string, text: string, lockAttempt = 0,
  ): Promise<StoryEvent | null> {
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
    if (!events.some(event => event?.type === 'turn/end' && Number(event.data?.turn) === Number(userTurn))) {
      throw new Error('本轮仍在运行，请等待结束后重新生成')
    }
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

  return {
    repairLegacyRootForkPointer,
    nativePlayerGroupsFor,
    repairLegacyUserReplacementIdentities,
    replaceAssistantText,
    reconcileCanonicalPlayerVariants,
    userForkContext,
    locatePlayerRecoveryTarget,
    replaceUserText,
  }
}
