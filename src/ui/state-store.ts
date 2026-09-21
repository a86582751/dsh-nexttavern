import {fetchRoleplayText as readRoleplayText} from './panel-state.js'

export interface StateReply extends Record<string, unknown> {
  ok?: boolean
  sessionId?: string
  preset?: string
  error?: unknown
}
export interface StateSessionService {
  binding?(sessionId: string): {session?: {open?(): unknown | PromiseLike<unknown>}} | null | undefined
  refresh?(): unknown | PromiseLike<unknown>
  open?(sessionId: string): unknown
}
interface StateStoreDependencies {
  sessionsService?: StateSessionService | null
  isRoleplaySession(sessionId: string): boolean
  fetchRoleplayText?: typeof readRoleplayText
  fetch?: typeof globalThis.fetch
  now?(): number
  wait?(ms: number): Promise<void>
}

export function createRoleplayStateStore({sessionsService,isRoleplaySession,fetchRoleplayText=readRoleplayText,fetch=globalThis.fetch,now=Date.now,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}: StateStoreDependencies) {
  const STATE_TTL_MS = 8000
  const stateCache = new Map<string, {at: number; data: StateReply}>()
  const stateInflight = new Map<string, {epoch: number; pending: Promise<StateReply>}>()
  const stateEpoch = new Map<string, number>()
  const stateListeners = new Map<string, Set<() => void>>()
  const subscribeState = (sessionId: string, listener: () => void) => {
    if (!sessionId || typeof listener !== 'function') return () => {}
    let listeners = stateListeners.get(sessionId)
    if (!listeners) {
      listeners = new Set()
      stateListeners.set(sessionId, listeners)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (!listeners.size) stateListeners.delete(sessionId)
    }
  }
  const invalidateState = (sessionId: string) => {
    stateCache.delete(sessionId)
    stateEpoch.set(sessionId, (stateEpoch.get(sessionId) ?? 0) + 1)
    // Message action rows are long-lived slot instances.  They used to retain
    // the pre-fork snapshot until an unrelated remount, which made a newly
    // settled 3/3 branch pager appear intermittently.  Wake every mounted row
    // so it fetches the same authoritative branch index immediately.
    for (const listener of [...(stateListeners.get(sessionId) ?? [])]) {
      try { listener() } catch {}
    }
  }
  const wakeSessionForState = async (sessionId: string) => {
    // The state route is owned by the roleplay Agent preset and therefore does
    // not exist until a cold persisted Session is resumed. Ask the always-on
    // Host bridge to resume exactly this Session; this activates no turn and
    // does not load sibling branches.
    try {
      const response = await fetch('/api/roleplay/wake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        cache: 'no-store',
      })
      const payload: StateReply | null = await response.json().catch(() => null)
      if (response.ok && payload?.ok) return true
    } catch {}

    // Compatibility fallback for profiles where the Host bridge has not yet
    // been installed. Opening the client binding is idempotent and never
    // creates or submits a Session.
    let binding = sessionsService?.binding?.(sessionId)
    if (!binding) {
      try { await sessionsService?.refresh?.() } catch {}
      binding = sessionsService?.binding?.(sessionId)
    }
    if (!binding) return false
    try { sessionsService?.open?.(sessionId) } catch {}
    try {
      if (typeof binding.session?.open === 'function') await binding.session.open()
    } catch {}
    return true
  }
  const fetchState = async (sessionId: string, force = false): Promise<StateReply> => {
    if (!isRoleplaySession(sessionId)) return { ok: true, sessionId, preset: 'other' }
    const hit = stateCache.get(sessionId)
    if (!force && hit && now() - hit.at < STATE_TTL_MS) return hit.data
    // `force` bypasses only the short-lived cache.  All callers still share the
    // same in-flight request so Reader, status bar and per-message controls do
    // not stampede the connection after a reconnect.
    const inflight = stateInflight.get(sessionId)
    const epoch = stateEpoch.get(sessionId) ?? 0
    if (inflight) {
      if (inflight.epoch === epoch) return inflight.pending
      // A completed turn invalidates a request another mounted reader started.
      // Wait for that request to release its slot, then read the new epoch.
      await inflight.pending.catch(() => {})
      if (stateInflight.get(sessionId) === inflight) stateInflight.delete(sessionId)
      return fetchState(sessionId, force)
    }
    const pending = (async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const {response:res,raw} = await fetchRoleplayText('/api/roleplay/state?sessionId=' + encodeURIComponent(sessionId))
        let data: StateReply | null = null
        let parseError = false
        try {
          data = raw ? JSON.parse(raw) : null
        } catch {
          parseError = true
        }
        if (res.status === 404 && attempt < 3 && await wakeSessionForState(sessionId)) {
          await wait(220 * (attempt + 1))
          continue
        }
        if (parseError) {
          // A proxy or an unmounted preset may return a plain-text error page.
          // Preserve the useful HTTP status instead of disguising the failure
          // as malformed successful JSON.
          if (!res.ok) {
            const detail = raw.trim().replace(/\s+/g, ' ').slice(0, 160)
            const error: Error & {status?: number} = new Error(`状态接口 HTTP ${res.status}${detail ? `：${detail}` : ''}`)
            error.status = res.status
            throw error
          }
          throw new Error(`状态接口返回了无效 JSON（HTTP ${res.status}）`)
        }
        if (!res.ok || !data?.ok) {
          const error: Error & {status?: number} = new Error(String(data?.error ?? `状态接口 HTTP ${res.status}`))
          error.status = res.status
          throw error
        }
        if ((stateEpoch.get(sessionId) ?? 0) === epoch) stateCache.set(sessionId, { at: now(), data })
        return data
      }
      throw new Error('状态接口在唤醒会话后仍不可用')
    })()
    stateInflight.set(sessionId, {epoch, pending})
    try {
      return await pending
    } finally {
      if (stateInflight.get(sessionId)?.pending === pending) stateInflight.delete(sessionId)
    }
  }

  return {fetchState,subscribeState,invalidateState,wakeSessionForState,peekState:(id: string)=>stateCache.get(id)?.data,stateVersion:(id: string)=>stateEpoch.get(id)??0}
}
