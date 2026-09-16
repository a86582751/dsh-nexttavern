import { keyOf, readUserInfo, writeUserInfo, recordSha256 } from './roleplay-data.js'
import { surfaceTextForSeqs } from './roleplay-context.js'
import { statusTemplateHtml, statusTemplateDiagnostics } from '../status-template.js'
import type { ServiceDependencies, ServiceSession, VersionRecord, ServiceWaitResult, ServiceDecisionInput } from './roleplay-service-types.js'

export function createRoleplayService<N>(deps: ServiceDependencies<N>) {
  const { nativeTask, storyBranchIsActive, ensureState, ctx, T, lockedFactsOf, cloneBranchRecord, memorySettingsPolicy, normalizeDecisionRecord, contextWindowKey, cloneContextWindow, normalizeStatusOption } = deps
  const svc = {
    nativeTask,
    ownsMemoryPreparation: true,
    isStoryBranchActive: storyBranchIsActive,
    async awaitCommitted(branchId: string, waitMs: unknown = 0): Promise<ServiceWaitResult> {
      const st = ensureState(branchId)
      const pending = (st.commitChain ?? Promise.resolve()).catch((error) => {
        ctx.logger?.warn?.(`roleplay: prior commit failed; continuing from last durable state: ${String(error)}`)
      })
      const boundedWaitMs = Number(waitMs)
      if (!Number.isFinite(boundedWaitMs) || boundedWaitMs <= 0) {
        await pending
        return { completed: true, timedOut: false }
      }
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeout = new Promise<ServiceWaitResult>((resolve) => {
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
    surfaceText(sessionId: string, seqs: Iterable<number>) {
      const session = ctx.sessions.get(sessionId)
      if (!session) return ''
      return surfaceTextForSeqs(session, seqs)
    },
    lockedFacts(branchId: string) {
      return lockedFactsOf(T, branchId)
    },
    memoryHead(branchId: string) {
      return T.memory.get(keyOf(branchId, 'head')) ?? null
    },
    async memoryUpdate(branchId: string, patch: Record<string, unknown>) {
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
    sceneCurrent(branchId: string) {
      return T.scene.get(keyOf(branchId, 'current')) ?? null
    },
    branchLineage(session: ServiceSession | null | undefined) {
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
    settings(branchId: string) {
      return memorySettingsPolicy(branchId).effective
    },
    async setSettings(branchId: string, patch: Record<string, unknown>) {
      const prev = T.branch.get(keyOf(branchId, 'settings')) ?? {}
      const next = { ...prev, ...patch, updatedAt: Date.now() }
      await T.branch.put(keyOf(branchId, 'settings'), next)
      return next
    },
    versions(branchId: string) {
      return T.branch.get(keyOf(branchId, 'versions')) ?? { anchors: {} }
    },
    async recordVersion(branchId: string, anchorSeq: unknown, turn: unknown, seq: unknown) {
      const key = keyOf(branchId, 'versions')
      if (!T.branch.get(key)) await T.branch.put(key, { anchors: {} })
      return T.branch.update(key, (current) => {
        const rec = cloneBranchRecord(current as VersionRecord | null | undefined) ?? { anchors: {} }
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
    statusSpec(branchId: string) {
      return T.status.get(keyOf(branchId, 'spec')) ?? null
    },
    async setStatusSpec(branchId: string, text: unknown, atSeq?: unknown, repairId?:string) {
      const previous=T.status.get(keyOf(branchId,'spec'))??{}
      // Retain import provenance, but never restore the old template over an intentional edit.
      const rec = { ...previous, schemaVersion:1, verified:false, editedFrom:{sha256:recordSha256(previous),source:'setting-edit',seq:atSeq,...(repairId?{repairId}:{})},
        text: String(text ?? ''), templateHtml:statusTemplateDiagnostics(text).mode==='author'?statusTemplateHtml(text):'', updatedAt: Date.now(), ...(Number.isSafeInteger(atSeq) ? { updatedAtSeq: atSeq } : {}) }
      await T.status.put(keyOf(branchId, 'spec'), rec)
      return rec
    },
    rulesOf(branchId: string) {
      return T.rules.get(keyOf(branchId, 'spec')) ?? null
    },
    async setRules(branchId: string, record: Record<string, unknown>, atSeq?: unknown) {
      const next = { ...record, schemaVersion:1, updatedAt: Date.now(), ...(Number.isSafeInteger(atSeq) ? { updatedAtSeq: atSeq } : {}) }
      await T.rules.put(keyOf(branchId, 'spec'), next)
      return next
    },
    opening(branchId: string) {
      return T.opening.get(keyOf(branchId, 'scene')) ?? null
    },
    async setOpening(branchId: string, text: unknown, atSeq?: unknown) {
      const rec = { text: String(text ?? ''), updatedAt: Date.now(), ...(Number.isSafeInteger(atSeq) ? { updatedAtSeq: atSeq } : {}) }
      await T.opening.put(keyOf(branchId, 'scene'), rec)
      return rec
    },
    userInfo() {
      return readUserInfo()
    },
    async setUserInfo(record: Record<string, unknown>) {
      const next = { ...(readUserInfo() ?? {}), ...record, updatedAt: Date.now() }
      writeUserInfo(next)
      return next
    },
    decision(branchId: string) {
      return normalizeDecisionRecord(T.decision.get(keyOf(branchId, 'current')))
    },
    contextWindow(branchId: string) {
      const value = T.branch.get(contextWindowKey(branchId))
      return value ? cloneContextWindow(value) : null
    },
    async askDecision(branchId: string, record: ServiceDecisionInput | null | undefined) {
      const rec = {
        source: record?.source ?? 'tool',
        seq: Number.isSafeInteger(record?.seq) ? record!.seq : 0,
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
  return svc
}
