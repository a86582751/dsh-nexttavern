// Generated from runtime/alpha3/src/ui/reader-submission-handoff.ts; edit the TypeScript source.
/** Owns only the local handoff before Native prompt admission. Reader leases
 * expire on unmount; they are never Source validity or persisted readiness. */
export function createReaderSubmissionHandoff(selection) {
    const readers = new Map();
    const tickets = new Set();
    const selected = () => selection.getSnapshot().key;
    const unsubscribe = selection.subscribe(() => {
        for (const ticket of tickets)
            ticket.selected();
    });
    return {
        capture(sourceSessionId) {
            const source = readers.get(sourceSessionId);
            if (selected() !== sourceSessionId || !source?.active) {
                throw Error('酒馆阅读视图尚未就绪，请打开后再操作。');
            }
            let childSessionId, child;
            let enteredChild = false, ready = false, forwarded = false, closed = false;
            let failure;
            let mountTimer;
            const waiters = new Set();
            const clearMountTimer = () => { clearTimeout(mountTimer); mountTimer = undefined; };
            const cancel = (message) => {
                if (failure || closed || forwarded)
                    return;
                failure = Error(message);
                clearMountTimer();
                for (const waiter of waiters)
                    waiter.reject(failure);
                waiters.clear();
            };
            const assertActive = () => {
                if (failure)
                    throw failure;
                if (closed || forwarded)
                    throw Error('这次阅读视图交接已经结束。');
            };
            const changed = (reader) => {
                if (reader !== child || failure || closed || forwarded)
                    return;
                const state = reader.state;
                if (state.kind === 'waiting' || state.kind === 'not-required') {
                    ready = true;
                    for (const waiter of waiters)
                        waiter.resolve();
                    waiters.clear();
                }
                else if (state.kind === 'failed' || state.kind === 'blocked') {
                    cancel(state.code ?? '作者交互尚未就绪，请先处理阅读视图中的提示。');
                }
                else if (ready) {
                    cancel('子会话阅读视图已更换，未发送消息。');
                }
            };
            const mounted = (reader) => {
                if (reader.sessionId !== childSessionId || failure || closed || forwarded)
                    return;
                child = reader;
                clearMountTimer();
                changed(reader);
            };
            const selectedChanged = () => {
                const current = selected();
                if (childSessionId && current === childSessionId)
                    enteredChild = true;
                else if (enteredChild || current !== sourceSessionId)
                    cancel('当前会话已切换，未发送消息。');
            };
            const observer = {
                selected: selectedChanged, mounted, changed, cancel,
                released(reader) {
                    if (reader === child || reader === source && (!childSessionId || selected() === sourceSessionId)) {
                        cancel('酒馆阅读视图已关闭，未发送消息。');
                    }
                },
            };
            tickets.add(observer);
            return {
                arm(id) {
                    assertActive();
                    childSessionId = id;
                    const existing = readers.get(id);
                    if (existing)
                        mounted(existing);
                    selectedChanged();
                },
                assertActive,
                opening() {
                    assertActive();
                    // Registration can take much longer than a render. This watchdog
                    // begins only at navigation, and stops at the actual Reader mount.
                    if (!child && mountTimer === undefined) {
                        mountTimer = setTimeout(() => cancel('子会话的酒馆阅读视图未能打开。'), 15000);
                    }
                },
                wait() {
                    if (failure)
                        return Promise.reject(failure);
                    if (ready)
                        return Promise.resolve();
                    return new Promise((resolve, reject) => waiters.add({ resolve, reject }));
                },
                consume(dispatch) {
                    assertActive();
                    // This owner transfers the still-live local lease to Native in one
                    // synchronous step; navigation after dispatch belongs to Native.
                    if (!ready || !child?.active || readers.get(child.sessionId) !== child
                        || selected() !== childSessionId)
                        throw Error('子会话阅读视图已离开，未发送消息。');
                    forwarded = true;
                    tickets.delete(observer);
                    clearMountTimer();
                    return dispatch();
                },
                close() {
                    cancel('这次发送已取消。');
                    closed = true;
                    tickets.delete(observer);
                    clearMountTimer();
                },
            };
        },
        mount(sessionId) {
            const previous = readers.get(sessionId);
            if (previous) {
                previous.active = false;
                for (const ticket of tickets)
                    ticket.released(previous);
            }
            const reader = { sessionId, active: true, state: { kind: 'starting' } };
            readers.set(sessionId, reader);
            for (const ticket of tickets)
                ticket.mounted(reader);
            return {
                publish(state) {
                    if (!reader.active)
                        return;
                    reader.state = state;
                    for (const ticket of tickets)
                        ticket.changed(reader);
                },
                dispose() {
                    if (!reader.active)
                        return;
                    reader.active = false;
                    if (readers.get(sessionId) === reader)
                        readers.delete(sessionId);
                    for (const ticket of tickets)
                        ticket.released(reader);
                },
            };
        },
        dispose() {
            unsubscribe();
            for (const ticket of tickets)
                ticket.cancel('酒馆界面已关闭，未发送消息。');
            tickets.clear();
            for (const reader of readers.values())
                reader.active = false;
            readers.clear();
        },
    };
}
