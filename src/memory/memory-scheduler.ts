export interface ScheduledSession { id: string }
export interface ScheduledAgent<S extends ScheduledSession> { session?: S }
interface RetryState { failures: number; retryAt: number; error?: string | null }
interface NotesState<A, N> extends RetryState {
  agent?: A
  promise: Promise<N | null> | null
  timer: ReturnType<typeof setTimeout> | null
  controller?: AbortController | null
  rerun?: boolean
}
export interface MemorySchedulerOptions<S extends ScheduledSession, A extends ScheduledAgent<S>, N, C> {
  config: { autoNotes?: unknown; autoRetryBaseMs?: unknown; autoRetryMaxMs?: unknown }
  isRoleplaySession: (session: S) => boolean
  notesDue: (session: S) => boolean
  notesBusy: ReadonlySet<string>
  busy: ReadonlySet<string>
  requestNotes: (session: S, agent: A, signal: AbortSignal) => Promise<N>
  requestCompaction: (session: S, agent: A, signal: AbortSignal | undefined, force: boolean) => Promise<C>
  aboveThreshold: (session: S) => boolean
  warn?: (message: string) => unknown
}

/** Own background scheduling and retry state. Durable writes remain in callers. */
export function createMemoryScheduler<S extends ScheduledSession, A extends ScheduledAgent<S>, N, C>(options: MemorySchedulerOptions<S, A, N, C>) {
  const { config, isRoleplaySession, notesDue, notesBusy, busy, requestNotes, requestCompaction, aboveThreshold } = options
  const automaticNotes = new Map<string, NotesState<A, N>>()
  const automaticCompaction = new Map<string, RetryState>()
  let disposed = false
  const notesState = (id: string): NotesState<A, N> => {
    let state = automaticNotes.get(id)
    if (!state) {
      state = { failures: 0, retryAt: 0, promise: null, timer: null }
      automaticNotes.set(id, state)
    }
    return state
  }
  const backoff = (state: RetryState, error: unknown) => {
    state.failures = (state.failures ?? 0) + 1
    const base = Math.max(1000, Number(config.autoRetryBaseMs) || 30000)
    const maximum = Math.max(base, Number(config.autoRetryMaxMs) || 300000)
    state.retryAt = Date.now() + Math.min(maximum, base * 2 ** Math.min(10, state.failures - 1))
    state.error = String(error !== null && typeof error === 'object' && 'message' in error ? error.message ?? error : error)
  }
  function dispose(): void {
    disposed = true
    for (const state of automaticNotes.values()) {
      if (state.timer !== null) clearTimeout(state.timer)
      state.controller?.abort(new Error('记忆插件已卸载'))
    }
  }
  async function organizeAutomatically(agent?: A | null, { checkpoint = false } = {}): Promise<N | null> {
    const session = agent?.session
    if (disposed || (!checkpoint && config.autoNotes === false) || !agent || !session || !isRoleplaySession(session)) return null
    if (!checkpoint && !notesDue(session)) return null
    const state = notesState(session.id)
    state.agent = agent
    if (state.promise) {
      state.rerun = true
      return state.promise
    }
    if ((!checkpoint && Date.now() < state.retryAt) || notesBusy.has(session.id)) return null
    const controller = new AbortController()
    state.controller = controller
    const job = requestNotes(session, agent, controller.signal)
      .then(result => {
        state.failures = 0
        state.retryAt = 0
        state.error = null
        return result
      }).catch((error: unknown) => {
        if (!disposed) {
          backoff(state, error)
          options.warn?.(`roleplay-memory: background notes failed; keeping previous notes until a new source or explicit retry: ${state.error}`)
        }
        return null
      }).finally(() => {
        state.promise = null
        state.controller = null
        // Only a queued newer story schedules another check. Failure alone
        // cannot create a paid retry of an unchanged durable task generation.
        if (!disposed && state.rerun) {
          if (state.timer !== null) clearTimeout(state.timer)
          state.rerun = false
          state.timer = setTimeout(() => {
            state.timer = null
            void organizeAutomatically(state.agent).catch(() => {})
          }, Math.max(1, state.retryAt - Date.now()))
          state.timer.unref?.()
        }
      })
    state.promise = job
    return job
  }
  function scheduleNotes(agent?: A | null): void {
    const session = agent?.session
    if (!agent || !session || !isRoleplaySession(session) || disposed) return
    const state = notesState(session.id)
    state.agent = agent
    if (state.promise) { state.rerun = true; return }
    if (state.timer) return
    state.timer = setTimeout(() => {
      state.timer = null
      void organizeAutomatically(state.agent).catch(() => {})
    }, Math.max(1, state.retryAt - Date.now()))
    state.timer.unref?.()
  }
  async function compactAutomatically(agent?: A | null, trigger = 'pressure', signal?: AbortSignal): Promise<C | null> {
    const session = agent?.session
    if (disposed || !agent || !session || !isRoleplaySession(session) || busy.has(session.id)) return null
    const state = automaticCompaction.get(session.id) ?? { failures: 0, retryAt: 0 }
    automaticCompaction.set(session.id, state)
    if (Date.now() < state.retryAt) return null
    try {
      if (trigger !== 'context-overflow' && !aboveThreshold(session)) return null
      const result = await requestCompaction(session, agent, signal, trigger === 'context-overflow')
      state.failures = 0
      state.retryAt = 0
      return result
    } catch (error: unknown) {
      if (!signal?.aborted) backoff(state, error)
      throw error
    }
  }
  return { organizeAutomatically, scheduleNotes, compactAutomatically, dispose,
    pendingNotes: (sessionId: string): Promise<N | null> | undefined => automaticNotes.get(sessionId)?.promise ?? undefined }
}
