export interface MemoryAgreement {
  schemaVersion: 1
  participants: string[]
  subject: string
  conditions: string[]
  time: string | null
  place: string | null
}

/** Native result admission owns this shape; stored deltas are consumed directly. */
export function assertMemoryAgreement(value: unknown): asserts value is MemoryAgreement {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('人物约定格式无效')
  const agreement = value as Record<string, unknown>
  if (agreement.schemaVersion !== 1
    || !Array.isArray(agreement.participants) || !agreement.participants.every(item => typeof item === 'string')
    || typeof agreement.subject !== 'string' || !agreement.subject.trim()
    || !Array.isArray(agreement.conditions) || !agreement.conditions.every(item => typeof item === 'string')
    || agreement.time !== null && typeof agreement.time !== 'string'
    || agreement.place !== null && typeof agreement.place !== 'string') throw new Error('人物约定格式无效')
}

export interface MemoryAgreementQuery {
  query?: unknown
  beforeSeq?: unknown
  limit?: unknown
}

export interface MemoryAgreementMatch {
  agreement: MemoryAgreement
  summary: string
  status: 'established' | 'uncertain'
  evidenceSeq: number
  sourceKey: string
  sessionId: string
  sourceGeneration: string
}

export function queryMemoryAgreements(sessionId: string,
  deltas: readonly Record<string, unknown>[] | null | undefined,
  { query = '', beforeSeq, limit = 12 }: MemoryAgreementQuery = {}) {
  const cap = Math.max(1, Math.min(100, Number(limit) || 12))
  const before = Number.isSafeInteger(beforeSeq) ? Number(beforeSeq) : null
  const terms = String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  // Branch inheritance and edits are already resolved by memoryHead's owner.
  // This discriminator selects the admitted new format without replaying history.
  const all = (deltas ?? []).filter(delta => (delta.agreement as MemoryAgreement | undefined)?.schemaVersion === 1)
  const candidates = all.filter(delta => {
    if (before !== null && (delta.evidenceSeq as number) >= before) return false
    const agreement = delta.agreement as MemoryAgreement
    const text = [...agreement.participants, agreement.subject, ...agreement.conditions,
      agreement.time ?? '', agreement.place ?? '', delta.summary as string].join('\n').toLocaleLowerCase()
    return terms.every(term => text.includes(term))
  }).sort((left, right) => (left.evidenceSeq as number) - (right.evidenceSeq as number))
  const entries: MemoryAgreementMatch[] = candidates.slice(-cap).map(delta => ({
    agreement: delta.agreement as MemoryAgreement,
    summary: delta.summary as string,
    status: delta.status as MemoryAgreementMatch['status'],
    evidenceSeq: delta.evidenceSeq as number,
    sourceKey: delta.sourceKey as string,
    sessionId: delta.sessionId as string,
    sourceGeneration: delta.sourceGeneration as string,
  }))
  return { schemaVersion: 1 as const, kind: 'agreements' as const, sessionId,
    totalEntries: all.length, matchedEntries: candidates.length, entries,
    note: all.length
      ? '约定要素保留原记录状态；可用 action=read、seq=evidenceSeq 回读当前世界线原文。'
      : '尚无结构化约定记录；可使用普通剧情历史检索。既有记录不会自动回填。' }
}
