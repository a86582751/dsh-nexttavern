const copy = value => {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

const catalogRoot = (id, catalog) => {
  const record = catalog?.schemaVersion === 1 ? catalog.worldlines?.[id] : undefined
  return record && typeof record.conversationId === 'string'
    ? record.conversationId
    : id
}

const validCatalog = catalog => catalog?.schemaVersion === 1 && catalog.worldlines && catalog.conversations

/** Project native Session summaries into one row per known worldline root. */
export function projectConversationList(nativeState, catalog) {
  const result = copy(nativeState ?? {})
  if (!validCatalog(catalog) || !Array.isArray(nativeState?.ids) || !nativeState.byId || typeof nativeState.byId !== 'object') return result
  const ids = [...nativeState.ids]
  const present = new Set(ids)
  const roots = new Map()
  const missingConversationIds = []
  for (const id of ids) {
    const root = catalogRoot(id, catalog)
    if (root !== id && !present.has(root)) {
      if (!missingConversationIds.includes(root)) missingConversationIds.push(root)
      continue
    }
    const entry = roots.get(root) ?? { members: [], first: id }
    entry.members.push(id)
    roots.set(root, entry)
  }
  const projectedIds = []
  const projectedById = {}
  for (const id of ids) {
    const root = catalogRoot(id, catalog)
    if (root !== id) continue
    const summary = nativeState.byId[id]
    if (!summary) continue
    const group = roots.get(id)
    const members = group?.members ?? [id]
    const summaries = members.map(member => nativeState.byId[member]).filter(Boolean)
    const updatedAt = Math.max(...summaries.map(item => Number(item.updatedAt)).filter(Number.isFinite), Number(summary.updatedAt) || 0)
    projectedIds.push(id)
    projectedById[id] = { ...copy(summary), updatedAt, running: summaries.some(item => item.running === true) }
    if(summary.parentSessionId&&catalogRoot(summary.parentSessionId,catalog)!==summary.parentSessionId)projectedById[id].parentSessionId=catalogRoot(summary.parentSessionId,catalog)
  }
  const currentRoot = catalogRoot(nativeState.current, catalog)
  return { ...result, ids: projectedIds, byId: projectedById, current: currentRoot, missingConversationIds }
}

/** Project workspace membership without mutating the native snapshot. */
export function projectConversationWorkspaces(nativeSnapshot, catalog) {
  const result = copy(nativeSnapshot ?? {})
  if (!validCatalog(catalog) || !Array.isArray(nativeSnapshot?.items)) return result
  const assignedRoots = new Set()
  const items = nativeSnapshot.items.map(item => {
    const sessionIds = []
    for (const id of Array.isArray(item?.sessionIds) ? item.sessionIds : []) {
      const root = catalogRoot(id, catalog)
      if (root !== id) continue
      if (!assignedRoots.has(id)) {
        sessionIds.push(id); assignedRoots.add(id)
      }
    }
    return { ...copy(item), sessionIds }
  })
  const archivedSessionIds = []
  for (const id of nativeSnapshot.archivedSessionIds ?? []) {
    const root = catalogRoot(id, catalog)
    if (root===id&&!archivedSessionIds.includes(id)) archivedSessionIds.push(id)
  }
  return { ...result, items, archivedSessionIds }
}

// Native search opens a Session (no per-message anchor). Only the book's
// selected worldline may supply its snippet; opening the row resolves the same
// execution ID through the durable catalog, never a discarded sibling.
export function projectConversationSearch(result,catalog) {
  if(!validCatalog(catalog))return copy(result??{})
  const seen=new Set(),items=[]
  for(const item of result?.items??[]) {
    const root=catalogRoot(item.sessionId,catalog),active=resolveConversationExecution(root,catalog)
    if(active!==item.sessionId||seen.has(root))continue
    seen.add(root)
    items.push(root===item.sessionId?copy(item):{...copy(item),sessionId:root,executionSessionId:item.sessionId})
  }
  return {...copy(result??{}),items}
}

const usableExecution = (root, candidate, catalog) => {
  if (candidate === root) return root
  const record = catalog?.worldlines?.[candidate]
  return record?.conversationId === root && record.status === 'ready' ? candidate : null
}

export function resolveConversationExecution(root, catalog) {
  if (!validCatalog(catalog) || typeof root !== 'string') return root
  const global = usableExecution(root, catalog.conversations?.[root]?.activeSessionId, catalog)
  return global ?? root
}
