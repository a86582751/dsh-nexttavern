// Generated from runtime/alpha3/src/memory/memory-agreements.ts; edit the TypeScript source.
/** Native result admission owns this shape; stored deltas are consumed directly. */
export function assertMemoryAgreement(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('人物约定格式无效');
    const agreement = value;
    if (agreement.schemaVersion !== 1
        || !Array.isArray(agreement.participants) || !agreement.participants.every(item => typeof item === 'string')
        || typeof agreement.subject !== 'string' || !agreement.subject.trim()
        || !Array.isArray(agreement.conditions) || !agreement.conditions.every(item => typeof item === 'string')
        || agreement.time !== null && typeof agreement.time !== 'string'
        || agreement.place !== null && typeof agreement.place !== 'string')
        throw new Error('人物约定格式无效');
}
export function queryMemoryAgreements(sessionId, deltas, { query = '', beforeSeq, limit = 12 } = {}) {
    const cap = Math.max(1, Math.min(100, Number(limit) || 12));
    const before = Number.isSafeInteger(beforeSeq) ? Number(beforeSeq) : null;
    const terms = String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    // Branch inheritance and edits are already resolved by memoryHead's owner.
    // This discriminator selects the admitted new format without replaying history.
    const all = (deltas ?? []).filter(delta => delta.agreement?.schemaVersion === 1);
    const candidates = all.filter(delta => {
        if (before !== null && delta.evidenceSeq >= before)
            return false;
        const agreement = delta.agreement;
        const text = [...agreement.participants, agreement.subject, ...agreement.conditions,
            agreement.time ?? '', agreement.place ?? '', delta.summary].join('\n').toLocaleLowerCase();
        return terms.every(term => text.includes(term));
    }).sort((left, right) => left.evidenceSeq - right.evidenceSeq);
    const entries = candidates.slice(-cap).map(delta => ({
        agreement: delta.agreement,
        summary: delta.summary,
        status: delta.status,
        evidenceSeq: delta.evidenceSeq,
        sourceKey: delta.sourceKey,
        sessionId: delta.sessionId,
        sourceGeneration: delta.sourceGeneration,
    }));
    return { schemaVersion: 1, kind: 'agreements', sessionId,
        totalEntries: all.length, matchedEntries: candidates.length, entries,
        note: all.length
            ? '约定要素保留原记录状态；可用 action=read、seq=evidenceSeq 回读当前世界线原文。'
            : '尚无结构化约定记录；可使用普通剧情历史检索。既有记录不会自动回填。' };
}
