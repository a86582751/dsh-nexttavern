/** Root-scoped references to the actual standing Core owners, not a task queue. */
export interface RoleplayOwnedWork {
  pending(): number
  close(): Promise<void>
}

interface RootWork {
  owners: Set<RoleplayOwnedWork>
  stopping: boolean
  closed?: Promise<void>
}
// Host and preset ship separate module copies, as with the existing side-chat
// bridge. Share one root WeakMap across those copies in this process realm.
const registry = globalThis as unknown as Record<symbol, WeakMap<object, RootWork> | undefined>
const roots = registry[Symbol.for('dsh.nexttavern.owned-work.v1')] ??= new WeakMap<object, RootWork>()

function stateOf(root: object): RootWork {
  let state = roots.get(root)
  if (!state) {
    state = { owners: new Set(), stopping: false }
    roots.set(root, state)
  }
  return state
}

/** Register one standing Core, including when no Agent currently retains it. */
export function registerRoleplayOwnedWork(root: object, owner: RoleplayOwnedWork): () => void {
  const state = stateOf(root)
  if (state.stopping) {
    // Core registers before constructing its completion/decision factories.
    // Rejecting activation here starts no new work or detached cleanup promise.
    throw new Error('ROLEPLAY_OWNED_WORK_STOPPED')
  }
  state.owners.add(owner)
  return () => { state.owners.delete(owner) }
}

/** This count comes from owner maps/timers, not Agent idle or port polling. */
export function pendingRoleplayOwnedWork(root: object): number {
  let pending = 0
  for (const owner of roots.get(root)?.owners ?? []) pending += owner.pending()
  return pending
}

/** Must finish BEFORE root disposal starts storage/provider teardown.
 * Cancellation and settlement are interruption, not successful turn completion. */
export function stopRoleplayOwnedWork(root: object): Promise<void> {
  const state = stateOf(root)
  if (state.closed) return state.closed
  state.stopping = true
  state.closed = Promise.all([...state.owners].map(owner => owner.close())).then(() => {})
  return state.closed
}
