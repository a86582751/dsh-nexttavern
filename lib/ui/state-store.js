// Generated from runtime/alpha3/src/ui/state-store.ts; edit the TypeScript source.
import { fetchRoleplayText as readRoleplayText } from './panel-state.js';
export function createRoleplayStateStore({ sessionsService, isRoleplaySession, fetchRoleplayText = readRoleplayText, fetch = globalThis.fetch, now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
    const STATE_TTL_MS = 8000;
    const stateCache = new Map();
    const stateInflight = new Map();
    const stateEpoch = new Map();
    const stateListeners = new Map();
    const subscribeState = (sessionId, listener) => {
        if (!sessionId || typeof listener !== 'function')
            return () => { };
        let listeners = stateListeners.get(sessionId);
        if (!listeners) {
            listeners = new Set();
            stateListeners.set(sessionId, listeners);
        }
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
            if (!listeners.size)
                stateListeners.delete(sessionId);
        };
    };
    const invalidateState = (sessionId) => {
        stateCache.delete(sessionId);
        stateEpoch.set(sessionId, (stateEpoch.get(sessionId) ?? 0) + 1);
        // Message action rows are long-lived slot instances.  They used to retain
        // the pre-fork snapshot until an unrelated remount, which made a newly
        // settled 3/3 branch pager appear intermittently.  Wake every mounted row
        // so it fetches the same authoritative branch index immediately.
        for (const listener of [...(stateListeners.get(sessionId) ?? [])]) {
            try {
                listener();
            }
            catch { }
        }
    };
    const wakeSessionForState = async (sessionId) => {
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
            });
            const payload = await response.json().catch(() => null);
            if (response.ok && payload?.ok)
                return true;
        }
        catch { }
        // A transient native acquisition opens history without changing the main
        // view. The Controller releases it on success and on opening failure.
        try {
            return await sessionsService?.using(sessionId, { source: 'nexttavernState' }, () => true) ?? false;
        }
        catch {
            return false;
        }
    };
    const fetchState = async (sessionId, force = false) => {
        if (!isRoleplaySession(sessionId))
            return { ok: true, sessionId, preset: 'other' };
        const hit = stateCache.get(sessionId);
        if (!force && hit && now() - hit.at < STATE_TTL_MS)
            return hit.data;
        // `force` bypasses only the short-lived cache.  All callers still share the
        // same in-flight request so Reader, status bar and per-message controls do
        // not stampede the connection after a reconnect.
        const inflight = stateInflight.get(sessionId);
        const epoch = stateEpoch.get(sessionId) ?? 0;
        if (inflight) {
            if (inflight.epoch === epoch)
                return inflight.pending;
            // A completed turn invalidates a request another mounted reader started.
            // Wait for that request to release its slot, then read the new epoch.
            await inflight.pending.catch(() => { });
            if (stateInflight.get(sessionId) === inflight)
                stateInflight.delete(sessionId);
            return fetchState(sessionId, force);
        }
        const pending = (async () => {
            for (let attempt = 0; attempt < 4; attempt += 1) {
                const { response: res, raw } = await fetchRoleplayText('/api/roleplay/state?sessionId=' + encodeURIComponent(sessionId));
                let data = null;
                let parseError = false;
                try {
                    data = raw ? JSON.parse(raw) : null;
                }
                catch {
                    parseError = true;
                }
                if (res.status === 404 && attempt < 3 && await wakeSessionForState(sessionId)) {
                    await wait(220 * (attempt + 1));
                    continue;
                }
                if (parseError) {
                    // A proxy or an unmounted preset may return a plain-text error page.
                    // Preserve the useful HTTP status instead of disguising the failure
                    // as malformed successful JSON.
                    if (!res.ok) {
                        const detail = raw.trim().replace(/\s+/g, ' ').slice(0, 160);
                        const error = new Error(`状态接口 HTTP ${res.status}${detail ? `：${detail}` : ''}`);
                        error.status = res.status;
                        throw error;
                    }
                    throw new Error(`状态接口返回了无效 JSON（HTTP ${res.status}）`);
                }
                if (!res.ok || !data?.ok) {
                    const error = new Error(String(data?.error ?? `状态接口 HTTP ${res.status}`));
                    error.status = res.status;
                    throw error;
                }
                if ((stateEpoch.get(sessionId) ?? 0) === epoch)
                    stateCache.set(sessionId, { at: now(), data });
                return data;
            }
            throw new Error('状态接口在唤醒会话后仍不可用');
        })();
        stateInflight.set(sessionId, { epoch, pending });
        try {
            return await pending;
        }
        finally {
            if (stateInflight.get(sessionId)?.pending === pending)
                stateInflight.delete(sessionId);
        }
    };
    return { fetchState, subscribeState, invalidateState, wakeSessionForState, peekState: (id) => stateCache.get(id)?.data, stateVersion: (id) => stateEpoch.get(id) ?? 0 };
}
