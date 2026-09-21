export interface ConversationCatalog {
  readonly schemaVersion: number
  readonly worldlines?: Readonly<Record<string, { readonly conversationId: string; readonly status?: string }>>
  readonly conversations?: Readonly<Record<string, { readonly activeSessionId?: string }>>
}
export interface SessionSummary {
  readonly updatedAt?: number | string | null
  readonly running?: boolean
  readonly parentSessionId?: string | null
  readonly [field: string]: unknown
}
export interface SessionList {
  readonly ids?: readonly string[]
  readonly byId?: Readonly<Record<string, SessionSummary | undefined>>
  readonly current?: string | null
  readonly [field: string]: unknown
}
export interface WorkspaceItem {
  readonly sessionIds?: readonly string[]
  readonly [field: string]: unknown
}
export interface WorkspaceSnapshot {
  readonly items?: readonly WorkspaceItem[]
  readonly archivedSessionIds?: readonly string[]
  readonly [field: string]: unknown
}
export interface SearchItem {
  readonly sessionId: string
  readonly [field: string]: unknown
}
export interface SearchResult {
  readonly items?: readonly SearchItem[]
  readonly [field: string]: unknown
}
type CatalogInput = ConversationCatalog | null | undefined
const copy = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}
const catalogRoot = <T extends string | null | undefined>(id: T, catalog: CatalogInput): T | string => {
  const record = catalog?.schemaVersion === 1 && typeof id === 'string' ? catalog.worldlines?.[id] : undefined
  return record && typeof record.conversationId === 'string' ? record.conversationId : id
}
const validCatalog = (catalog: CatalogInput): catalog is Required<ConversationCatalog> =>
  !!(catalog?.schemaVersion === 1 && catalog.worldlines && catalog.conversations)

/** Project native Session summaries into one row per known worldline root. */
export function projectConversationList(nativeState: SessionList | null | undefined, catalog: CatalogInput) {
  // Native context timelines can be megabytes. Share read-only nested values.
  const result = { ...nativeState }
  if (!validCatalog(catalog) || !Array.isArray(nativeState?.ids) || !nativeState?.byId || typeof nativeState.byId !== 'object') return result
  const ids = nativeState.ids
  const present = new Set(ids)
  const roots = new Map<string, string[]>()
  const missing = new Set<string>()
  for (const id of ids) {
    const root = catalogRoot(id, catalog)
    if (root !== id && !present.has(root)) { missing.add(root); continue }
    const members = roots.get(root) ?? []
    members.push(id)
    roots.set(root, members)
  }
  const projectedIds: string[] = []
  const projectedById: Record<string, SessionSummary> = {}
  for (const id of ids) {
    if (catalogRoot(id, catalog) !== id) continue
    const summary = nativeState.byId[id]
    if (!summary) continue
    let updatedAt = Number(summary.updatedAt) || 0
    let running = false
    for (const member of roots.get(id) ?? [id]) {
      const item = nativeState.byId[member]
      if (!item) continue
      const time = Number(item.updatedAt)
      if (Number.isFinite(time)) updatedAt = Math.max(updatedAt, time)
      if (item.running === true) running = true
    }
    projectedIds.push(id)
    const parentSessionId = summary.parentSessionId ? catalogRoot(summary.parentSessionId, catalog) : summary.parentSessionId
    projectedById[id] = summary.updatedAt === updatedAt && summary.running === running && summary.parentSessionId === parentSessionId
      ? summary : { ...summary, updatedAt, running, ...(parentSessionId !== summary.parentSessionId ? { parentSessionId } : {}) }
  }
  return { ...result, ids: projectedIds, byId: projectedById, current: catalogRoot(nativeState.current, catalog), missingConversationIds: [...missing] }
}

/** Project workspace membership without mutating the native snapshot. */
export function projectConversationWorkspaces(nativeSnapshot: WorkspaceSnapshot | null | undefined, catalog: CatalogInput) {
  // A workspace carries every session id in it, so cloning the whole snapshot on
  // each native update is the same cost projectConversationList already dropped:
  // share the read-only nested values and rebuild only the membership arrays that
  // actually differ.
  const result = { ...(nativeSnapshot ?? {}) }
  if (!validCatalog(catalog) || !Array.isArray(nativeSnapshot?.items)) return result
  const assignedRoots = new Set<string>()
  const items = nativeSnapshot.items.map(item => {
    const source = Array.isArray(item?.sessionIds) ? item.sessionIds : []
    const sessionIds: string[] = []
    for (const id of source) {
      if (catalogRoot(id, catalog) !== id || assignedRoots.has(id)) continue
      sessionIds.push(id); assignedRoots.add(id)
    }
    const unchanged = sessionIds.length === source.length && sessionIds.every((value, index) => value === source[index])
    return unchanged ? item : { ...item, sessionIds }
  })
  const sourceArchived = nativeSnapshot.archivedSessionIds ?? []
  const archived: string[] = []
  for (const id of sourceArchived) if (catalogRoot(id, catalog) === id) archived.push(id)
  const archivedUnchanged = archived.length === sourceArchived.length && archived.every((value, index) => value === sourceArchived[index])
  return { ...result, items, ...(archivedUnchanged ? {} : { archivedSessionIds: archived }) }
}

// Native search opens a Session. Only its selected worldline may supply the snippet.
export function projectConversationSearch(result: SearchResult | null | undefined, catalog: CatalogInput) {
  if (!validCatalog(catalog)) return copy(result ?? {})
  const seen = new Set<string>(), items: SearchItem[] = []
  for (const item of result?.items ?? []) {
    const root = catalogRoot(item.sessionId, catalog), active = resolveConversationExecution(root, catalog)
    if (active !== item.sessionId || seen.has(root)) continue
    seen.add(root)
    items.push(root === item.sessionId ? copy(item) : { ...copy(item), sessionId: root, executionSessionId: item.sessionId })
  }
  return { ...copy(result ?? {}), items }
}

const usableExecution = (root: string, candidate: string | undefined, catalog: ConversationCatalog) => {
  if (candidate === root) return root
  const record = candidate === undefined ? undefined : catalog.worldlines?.[candidate]
  return record?.conversationId === root && record.status === 'ready' ? candidate : null
}
export function resolveConversationExecution<T extends string | null | undefined>(root: T, catalog: CatalogInput): T | string {
  if (!validCatalog(catalog) || typeof root !== 'string') return root
  return usableExecution(root, catalog.conversations[root]?.activeSessionId, catalog) ?? root
}
