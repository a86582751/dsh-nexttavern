// Generated from runtime/alpha3/ui/panel-state.ts; edit the TypeScript source.
// Bound the whole response, including a stalled body. A hung connection must
// release activity busy/stateInflight so the next poll can recover.
export async function fetchRoleplayText(url, timeoutMs = 15000) {
    const controller = new AbortController();
    let timer;
    const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('酒馆状态请求超时，正在重试')); }, timeoutMs);
    });
    try {
        return await Promise.race([(async () => {
                const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
                return { response, raw: await response.text() };
            })(), deadline]);
    }
    finally {
        clearTimeout(timer);
    }
}
export function startActivityPolling({ eligible, read, receive, schedule = fn => setInterval(fn, 3000), cancel = clearInterval }) {
    let alive = true, busy = false;
    const load = async () => {
        if (!alive || busy || !eligible())
            return;
        busy = true;
        try {
            const data = await read();
            if (alive)
                receive(data);
        }
        catch { }
        finally {
            busy = false;
        }
    };
    void load();
    const timer = schedule(load);
    return () => { alive = false; cancel(timer); };
}
// Coalesce invalidation/timer requests while one refresh is in flight. A
// queued request runs once after the current run settles, then is discarded.
export const createRefreshScheduler = (run) => {
    let running = false;
    let queued = false;
    let closed = false;
    const request = () => {
        if (closed)
            return;
        if (running) {
            queued = true;
            return;
        }
        running = true;
        Promise.resolve().then(run).finally(() => {
            running = false;
            if (queued && !closed) {
                queued = false;
                request();
            }
            else
                queued = false;
        });
    };
    return { request, close: () => { closed = true; queued = false; } };
};
export function updatePanelDraft(store, sessionId, tab, patch) {
    const key = `${sessionId ?? 'none'}:${tab}`;
    const next = { ...(store.get(key) ?? {}), ...(patch ?? {}) };
    store.set(key, next);
    return next;
}
export function buildRulesSaveBody(field, value, rules = {}) {
    const apiField = field === 'styleKw' ? 'style' : field;
    return { kind: 'rules', [apiField]: value ?? '' };
}
export function buildCustomRulesSaveBody(narrative, reply) {
    return { kind: 'rules', narrative: narrative ?? '', reply: reply ?? '' };
}
export function markPanelDraftFields(store, sessionId, tab, patch) {
    const key = `${sessionId ?? 'none'}:${tab}`;
    const prior = store.get(key) ?? {};
    const fieldSeqs = { ...(prior.fieldSeqs ?? {}) };
    const dirtyFields = new Set(prior.dirtyFields ?? []);
    for (const field of Object.keys(patch ?? {})) {
        fieldSeqs[field] = Number(fieldSeqs[field] ?? 0) + 1;
        dirtyFields.add(field);
    }
    const next = { ...prior, ...(patch ?? {}), dirty: true, dirtyFields: [...dirtyFields], fieldSeqs };
    store.set(key, next);
    return next;
}
export function settlePanelDraftFields(store, sessionId, tab, fields, versions, expectedSeqs) {
    const key = `${sessionId ?? 'none'}:${tab}`;
    const prior = store.get(key);
    if (!prior)
        return null;
    const expected = typeof expectedSeqs === 'number' ? Object.fromEntries(fields.map(field => [field, expectedSeqs])) : (expectedSeqs ?? {});
    const next = { ...prior, baseVersions: { ...(prior.baseVersions ?? {}), ...(versions ?? {}) } };
    const dirtyFields = new Set(prior.dirtyFields ?? []);
    for (const field of fields) {
        if (expected[field] !== undefined && prior.fieldSeqs?.[field] !== expected[field])
            continue;
        delete next[field];
        dirtyFields.delete(field);
    }
    next.dirtyFields = [...dirtyFields];
    next.dirty = next.dirtyFields.length > 0;
    if (!next.dirty)
        store.delete(key);
    else
        store.set(key, next);
    return next.dirty ? next : null;
}
